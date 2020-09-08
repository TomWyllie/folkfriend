import Dexie from 'dexie';

class DatabaseService {
    MAX_NUD_AGE = 28;   // 28 days = 4 weeks

    constructor() {
        console.debug(`${this.constructor.name} init`);

        let db = new Dexie('folkfriend');
        // Setup database schema
        db.version(1).stores({
            /* Version string to track when the Non-User Data was updated last */
            NUDVersion: '++alwaysZero',

            /* Non-user data */
            settings: '&setting, tune, name, type, meter, mode',    // 'abc' added but not indexed
            aliases: '&tune, *aliases',
            // Generic table for our bulky objects. Bulky objects are NOT!!! indexed.
            // These are the shard meta JSON and the partitioned shards pngs in base 64.
            bulk: 'name',

            /* User data */
            transcriptions: 'timestamp, name',  // 'midis' added but not indexed
            history: 'timestamp, tune'   // 'midis' added but not indexed
        });

        this.db = db;
        this.checkForUpdates().then();
    }

    async checkForUpdates() {
        let NUDVersionLocal = await this.getNUDVersionLocal();
        let NUDVersionRemote = await this.getNUDVersionRemote();

        let canUpdate = NUDVersionRemote !== NUDVersionLocal;
        let NUDExpired = this.daysSince2020() - NUDVersionLocal > this.MAX_NUD_AGE;

        console.debug(this.daysSince2020());
        console.debug(NUDVersionLocal);
        console.debug(NUDVersionRemote);

        if(!canUpdate) {
            return;
        }

        if (NUDVersionLocal === false) {
            this.updateNonUserData().catch(e => {
                // This is a very bad state to be in.
                //  No tune database was found and we failed to install one.
                //  This is not a critical error but needs a graceful fallback.
                console.error(e);
            });
        } else if (NUDExpired) {
            this.updateNonUserData().catch(e => {
                // This is a not so bad state to be in.
                //  A tune database was found but we failed to upgrade.
                //  This is only concerning if it keeps happening.
                console.warn(e);
            });
        }
    }

    async getNUDVersionLocal() {
        const version = await this.db.NUDVersion.get(0);
        if (typeof version === 'undefined') {
            // No install detected.
            return false;
        }
        return version;
    }

    async getNUDVersionRemote() {
        let response = await fetch('http://82.2.76.175/version.txt');
        let rawVersion = await response.text();
        return parseInt(rawVersion);
    }

    async updateNonUserData() {

    }

    daysSince2020() {
        const unixMs = Date.now();
        const unixS = Math.round(unixMs / 1000);

        // 1577836800 = 2020-01-01T00:00:00+00:00 in ISO 8601
        const secsSince2020 = unixS - 1577836800;
        const daysSince2020 = Math.round(secsSince2020 / (24 * 3600));

        // NO time travelling >:c
        return Math.max(0, daysSince2020);
    }
}

const ds = new DatabaseService();
export default ds;
