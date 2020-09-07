import Dexie from 'dexie';

const db = new Dexie('folkfriend');
db.version(1).stores({
    settings: '&setting, tune, name, type, meter, mode',     // 'abc' added but not indexed
    aliases: '&tune, *aliases'
});

export default db;