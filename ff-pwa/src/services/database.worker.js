import Dexie from "dexie";
import utils from "@/folkfriend/ff-utils";

class DatabaseService {
    // MAX_NUD_AGE = 28;   // 28 days = 4 weeks
    MAX_NUD_AGE = 0;   // 0 = always use latest version

    constructor() {
        this.dbHost = 'https://raw.githubusercontent.com/TomWyllie/folkfriend-app-data/master';
        this.db = null;
        this.loaded = null;
        this.networkProgress = {};

        this._bulkSettings = null;
        this._bulkAlises = null;
        this.settingBySettingID = null;
        this.settingByTuneID = null;

        this.ready = new Promise((resolve) => {
            this.setReady = resolve;
        });
    }

    async verifyLoaded() {
        await this.ready;
        if (this.loaded === false) {
            throw 'Database failed to load';
        }
    }

    async initialise() {
        let db = new Dexie('folkfriend');
        // Setup database schema
        db.version(1).stores({
            /* Version string to track when the Non-User Data was updated last */
            NUDVersion: 'key',    // We always store this at key zero. We only need one entry in this table.

            /* Non-user data */
            // settings: '&setting, tune, name, type, meter, mode',    // 'abc' added but not indexed
            // settings: '&setting, tune, name',    // 'abc, type, meter, mode' added but not indexed for performance reasons
            // aliases: '&tune, *aliases',

            // Generic table for our bulky objects. Bulky objects are NOT!!! indexed.
            // These are the shard meta JSON and the partitioned shards pngs in base 64.
            bulk: 'name',

            /* User data */
            // transcriptions: '++id, timestamp, name',  // 'midis' added but not indexed
            // history: '++id, timestamp, tune'   // 'midis' added but not indexed
        });

        this.db = db;

        let NUDVersionLocal = await this.getNUDVersionLocal();

        if (NUDVersionLocal === null) {
            // We need to update the database to get some data.
            console.debug('NUData has not been loaded, attempting to update');

            try {
                // Block this function from resolving until we have updated
                await this.checkForUpdates(NUDVersionLocal);
                await this.loadBulkData();
                console.debug('NUData installed for first time');
                this.loaded = true;
            } catch (e) {
                // This is a very bad state to be in.
                //  No tune database was found and we failed to install one.
                //  This is not a fatal error but needs a graceful fallback.
                console.error(e);
                this.loaded = false;
            }
        } else {
            await this.loadBulkData();

            // Here we do not block this function from resolving as we want
            //  to get to initialising other parts of the app ASAP. We even
            //  delay this update from happening for a few seconds as the
            //  update can be quite intensive on network / CPU especially
            //  if indexing / decoding downloaded data. If the user is on a
            //  slow device we probably don't want this to conflict with
            //  initialising the query engine so just update whenever is a
            //  good time. 20 seconds from now is deemed to be a good time.
            setTimeout(() => {
                this.checkForUpdates(NUDVersionLocal).then((didUpdate) => {
                    if (didUpdate) {
                        console.debug('NUData has been updated to latest version');
                    }
                }).catch((e) => {
                    console.warn(e);
                    console.warn('NUData could not update');
                });
            }, 2000);   // Debug
            // }, 20000);       // Production
            this.loaded = true;
        }

        this.setReady();
    }

    async loadBulkData() {
        // But wait isn't this pointless?? Why use a fancy database backend and
        //  then just store the whole database of 30k-40k tunes as an object in
        //  the worker?? Doesn't that defeat the point of having a database??
        //  Answer: it certainly isn't ideal but on first load on a slow phone
        //  the indexing takes unacceptably long (~1 minute) and so we just do
        //  it the easy way. At least Dexie means all the versioning and stuff
        //  is done nicely.
        this._bulkSettings = this._bulkSettings || (await this.db.bulk.get({name: 'settings'})).value;
        this._bulkAlises = this._bulkAlises || (await this.db.bulk.get('aliases')).value;
        this.settingBySettingID = this.settingBySettingID || (await this.db.bulk.get('tuneBySettingID')).value;
        this.settingByTuneID = this.settingByTuneID || (await this.db.bulk.get('tuneByTuneID')).value;
    }

    async checkForUpdates(NUDVersionLocal) {
        let NUDMetaRemote = await this.getNUDMetaRemote();
        let NUDVersionRemote = NUDMetaRemote['v'];
        let NUDSize = NUDMetaRemote['size'];

        console.debug('NUDVersionLocal', NUDVersionLocal);
        console.debug('NUDMetaRemote', NUDMetaRemote);

        if (NUDVersionRemote === null) {
            throw 'Could not find NUDVersionRemote';
        }

        if (NUDVersionRemote === NUDVersionLocal) {
            console.debug('Database already latest version');
            return false;
        }

        let NUDExpired = utils.daysSince2020() - NUDVersionLocal > this.MAX_NUD_AGE;
        if (!NUDExpired) {
            console.debug('Database could update but current version has not yet expired');
            return false;
        }

        // Okay we should actually update the data then
        await this.updateNonUserData(NUDVersionRemote, NUDSize);

        // We updated
        return true;
    }

    async getNUDVersionLocal() {
        const versionObj = await this.db.NUDVersion.get(0);
        if (typeof versionObj === 'undefined') {
            // No install detected.
            return null;
        }
        return versionObj.v;
    }

    async getNUDMetaRemote() {
        try {
            let response = await fetch(`${this.dbHost}/nud-meta.json`);
            return await response.json();
        } catch (e) {
            return {"v": null, "size": null};
        }
    }

    async getQueryEngineData() {
        await this.verifyLoaded();
        return {
            partitionsData: (await this.db.bulk.get('partitionsData')).value,
            shardMeta: (await this.db.bulk.get('shardMeta')).value
        };
    }

    async updateNonUserData(NUDVersionRemote, NUDSize) {
        // We now fetch the big data file.
        const NUData = await this.fetchJSONWithProgress(
            'NUData',
            `${this.dbHost}/folkfriend-non-user-data.json`,
            NUDSize);

        // The JSON file stores the big PNG shard partitions as base64 (because
        //  it's easy to transfer in JSON). However if we send megabyte size
        //  base64 strings to the main thread to decode and load into an
        //  HTMLImageElement every time we want to instantiate a QueryEngine
        //  then we hammer the UI framerate. The solution is to convert from
        //  Base64 to blob, once, inside this worker, and store the blob inside
        //  IndexedDB (using Dexie).
        for (let i = 0; i < NUData['shard-partitions'].length; i++) {
            // data:image/png;base64,<............................>
            const fetchedPartition = await fetch(NUData['shard-partitions'][i]);
            NUData['shard-partitions'][i] = await fetchedPartition.blob();
        }

        // Now we have to generate a few database mapping things ourselves
        //  (Dexie too slow for this as discussed previously).
        const settingBySettingID = {};
        const settingByTuneID = {};

        for (let i = 0; i < NUData['tunes'].length; i++) {
            const tune = NUData['tunes'][i];
            settingBySettingID[tune['setting']] = i;
            settingByTuneID[tune['tune']] = i;
        }

        // Now use the big data file to update the IDB.
        //  This is a transaction so either it all works or it all rejects (thanks Dexie).
        await this.db.transaction('rw', [
            this.db.NUDVersion,
            this.db.bulk
        ], function () {
            /* Update bulk data objects */
            this.db.bulk.put({
                name: 'shardMeta',
                value: NUData['shard-to-settings']
            });

            this.db.bulk.put({
                name: 'partitionsData',
                value: NUData['shard-partitions']
            });

            /* Update tune settings */
            this.db.bulk.put({
                name: 'settings',
                value: NUData['tunes']
            });

            this.db.bulk.put({
                name: 'tuneBySettingID',
                value: settingBySettingID
            });

            this.db.bulk.put({
                name: 'tuneByTuneID',
                value: settingByTuneID
            });

            /* Update aliases */
            this.db.bulk.put({
                name: 'aliases',
                value: NUData['aliases']
            });

            /* Now bump version */
            this.db.NUDVersion.put({
                key: 0,
                v: NUDVersionRemote
            });
        });

        // Saves us loading in these from the database if we've only
        //  just put them in.
        this._bulkSettings = NUData['tunes'];
        this._bulkAlises = NUData['aliases'];
        this.settingBySettingID = settingBySettingID;
        this.settingByTuneID = settingByTuneID;
    }

    async fetchJSONWithProgress(requestLabel, url, size) {
        // Taken directly from
        //  https://javascript.info/fetch-progress

        // Step 1: start the fetch and obtain a reader
        let response = await fetch(url);

        const reader = response.body.getReader();

        // Step 2: get total length
        //  Prefer to pass size in from metadata file as gzip means
        //  there's a mismatch between content length and received length
        if (typeof size === 'undefined') {
            size = +response.headers.get('Content-Length');
        }

        // Step 3: read the data
        let receivedLength = 0; // received that many bytes at the moment
        let chunks = []; // array of received binary chunks (comprises the body)

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let {done, value} = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            receivedLength += value.length;

            this.networkProgress[requestLabel] = 100 * receivedLength / size;
        }

        // Step 4: concatenate chunks into single Uint8Array
        let chunksAll = new Uint8Array(receivedLength); // (4.1)
        let position = 0;
        for (let chunk of chunks) {
            chunksAll.set(chunk, position); // (4.2)
            position += chunk.length;
        }

        // Step 5: decode into a string
        let result = new TextDecoder('utf-8').decode(chunksAll);

        // We're done!
        return JSON.parse(result);
    }

    async settingsFromIDs(results) {
        await this.verifyLoaded();
        return results.map(({setting}) => this.setting(setting));
    }

    async settingsFromMidiQuery(results) {
        const settings = await this.settingsFromIDs(results);
        // let seenTuneIDs = new Set();
        /* eslint-disable */
        for(const [i, setting] of settings.entries()) {
            settings[i].score = results[i];
        }
        return settings;
    }

    setting(sID) {
        return this._bulkSettings[this.settingBySettingID[sID]];
    }

    tune(tID) {
        return this._bulkSettings[this.settingByTuneID[tID]];
    }
}

const ds = new DatabaseService();
export default ds;
