//Combined service worker for Spaces Chrome Extension (Manifest V3)
//This file combines: db.js, dbService.js, spacesService.js, utils.js, and background.js

console.log('Service worker starting...');

// Global initialization state
let isServiceWorkerInitialized = false;

// ===== DB.JS =====
//The MIT License
//Copyright (c) 2012 Aaron Powell

try {
(function(globalScope, undefined) {
    'use strict';

    var indexedDB,
        IDBKeyRange,
        transactionModes = {
            readonly: 'readonly',
            readwrite: 'readwrite',
        };

    // Initialize IDBKeyRange safely
    try {
        IDBKeyRange = globalScope.IDBKeyRange || globalScope.webkitIDBKeyRange;
    } catch (e) {
        console.warn('IDBKeyRange not available:', e);
    }

    var hasOwn = Object.prototype.hasOwnProperty;

    var getIndexedDB = function() {
        if (!indexedDB) {
            try {
                indexedDB =
                    globalScope.indexedDB ||
                    globalScope.webkitIndexedDB ||
                    globalScope.mozIndexedDB ||
                    globalScope.oIndexedDB ||
                    globalScope.msIndexedDB;

                if (!indexedDB) {
                    throw new Error('IndexedDB required');
                }
            } catch (e) {
                console.error('Failed to initialize IndexedDB:', e);
                throw e;
            }
        }
        return indexedDB;
    };

    var defaultMapper = function(value) {
        return value;
    };

    var CallbackList = function() {
        var state,
            list = [];

        var exec = function(context, args) {
            if (list) {
                args = args || [];
                state = state || [context, args];

                for (var i = 0, il = list.length; i < il; i++) {
                    list[i].apply(state[0], state[1]);
                }

                list = [];
            }
        };

        this.add = function() {
            for (var i = 0, il = arguments.length; i < il; i++) {
                list.push(arguments[i]);
            }

            if (state) {
                exec();
            }

            return this;
        };

        this.execute = function() {
            exec(this, arguments);
            return this;
        };
    };

    var Server = function(db, name) {
        var that = this,
            closed = false;

        this.add = function(table) {
            if (closed) {
                throw 'Database has been closed';
            }

            var records = [];
            var counter = 0;

            for (var i = 0; i < arguments.length - 1; i++) {
                if (Array.isArray(arguments[i + 1])) {
                    for (var j = 0; j < arguments[i + 1].length; j++) {
                        records[counter] = arguments[i + 1][j];
                        counter++;
                    }
                } else {
                    records[counter] = arguments[i + 1];
                    counter++;
                }
            }

            var transaction = db.transaction(table, transactionModes.readwrite),
                store = transaction.objectStore(table);

            return new Promise(function(resolve, reject) {
                records.forEach(function(record) {
                    var req;
                    if (record.item && record.key) {
                        var key = record.key;
                        record = record.item;
                        req = store.add(record, key);
                    } else {
                        req = store.add(record);
                    }

                    req.onsuccess = function(e) {
                        var target = e.target;
                        var keyPath = target.source.keyPath;
                        if (keyPath === null) {
                            keyPath = '__id__';
                        }
                        Object.defineProperty(record, keyPath, {
                            value: target.result,
                            enumerable: true,
                        });
                    };
                });

                transaction.oncomplete = function() {
                    resolve(records, that);
                };
                transaction.onerror = function(e) {
                    reject(e);
                };
                transaction.onabort = function(e) {
                    reject(e);
                };
            });
        };

        this.update = function(table) {
            if (closed) {
                throw 'Database has been closed';
            }

            var records = [];
            for (var i = 0; i < arguments.length - 1; i++) {
                records[i] = arguments[i + 1];
            }

            var transaction = db.transaction(table, transactionModes.readwrite),
                store = transaction.objectStore(table),
                keyPath = store.keyPath;

            return new Promise(function(resolve, reject) {
                records.forEach(function(record) {
                    var req;
                    var count;
                    if (record.item && record.key) {
                        var key = record.key;
                        record = record.item;
                        req = store.put(record, key);
                    } else {
                        req = store.put(record);
                    }

                    req.onsuccess = function(e) {
                        // deferred.notify(); es6 promise can't notify
                    };
                });

                transaction.oncomplete = function() {
                    resolve(records, that);
                };
                transaction.onerror = function(e) {
                    reject(e);
                };
                transaction.onabort = function(e) {
                    reject(e);
                };
            });
        };

        this.remove = function(table, key) {
            if (closed) {
                throw 'Database has been closed';
            }
            var transaction = db.transaction(table, transactionModes.readwrite),
                store = transaction.objectStore(table);

            return new Promise(function(resolve, reject) {
                var req = store['delete'](key);
                transaction.oncomplete = function() {
                    resolve(key);
                };
                transaction.onerror = function(e) {
                    reject(e);
                };
            });
        };

        this.clear = function(table) {
            if (closed) {
                throw 'Database has been closed';
            }
            var transaction = db.transaction(table, transactionModes.readwrite),
                store = transaction.objectStore(table);

            var req = store.clear();
            return new Promise(function(resolve, reject) {
                transaction.oncomplete = function() {
                    resolve();
                };
                transaction.onerror = function(e) {
                    reject(e);
                };
            });
        };

        this.close = function() {
            if (closed) {
                throw 'Database has been closed';
            }
            db.close();
            closed = true;
            delete dbCache[name];
        };

        this.get = function(table, id) {
            if (closed) {
                throw 'Database has been closed';
            }
            var transaction = db.transaction(table),
                store = transaction.objectStore(table);

            var req = store.get(id);
            return new Promise(function(resolve, reject) {
                req.onsuccess = function(e) {
                    resolve(e.target.result);
                };
                transaction.onerror = function(e) {
                    reject(e);
                };
            });
        };

        this.query = function(table, index) {
            if (closed) {
                throw 'Database has been closed';
            }
            return new IndexQuery(table, db, index);
        };

        for (var i = 0, il = db.objectStoreNames.length; i < il; i++) {
            (function(storeName) {
                that[storeName] = {};
                for (var i in that) {
                    if (!hasOwn.call(that, i) || i === 'close') {
                        continue;
                    }
                    that[storeName][i] = (function(i) {
                        return function() {
                            var args = [storeName].concat(
                                [].slice.call(arguments, 0)
                            );
                            return that[i].apply(that, args);
                        };
                    })(i);
                }
            })(db.objectStoreNames[i]);
        }
    };

    var IndexQuery = function(table, db, indexName) {
        var that = this;
        var modifyObj = false;

        var runQuery = function(
            type,
            args,
            cursorType,
            direction,
            limitRange,
            filters,
            mapper
        ) {
            var transaction = db.transaction(
                    table,
                    modifyObj
                        ? transactionModes.readwrite
                        : transactionModes.readonly
                ),
                store = transaction.objectStore(table),
                index = indexName ? store.index(indexName) : store,
                keyRange = type ? IDBKeyRange[type].apply(null, args) : null,
                results = [],
                indexArgs = [keyRange],
                limitRange = limitRange ? limitRange : null,
                filters = filters ? filters : [],
                counter = 0;

            if (cursorType !== 'count') {
                indexArgs.push(direction || 'next');
            }

            // create a function that will set in the modifyObj properties into
            // the passed record.
            var modifyKeys = modifyObj ? Object.keys(modifyObj) : false;
            var modifyRecord = function(record) {
                for (var i = 0; i < modifyKeys.length; i++) {
                    var key = modifyKeys[i];
                    var val = modifyObj[key];
                    if (val instanceof Function) val = val(record);
                    record[key] = val;
                }
                return record;
            };

            index[cursorType].apply(index, indexArgs).onsuccess = function(e) {
                var cursor = e.target.result;
                if (typeof cursor === typeof 0) {
                    results = cursor;
                } else if (cursor) {
                    if (limitRange !== null && limitRange[0] > counter) {
                        counter = limitRange[0];
                        cursor.advance(limitRange[0]);
                    } else if (
                        limitRange !== null &&
                        counter >= limitRange[0] + limitRange[1]
                    ) {
                        //out of limit range... skip
                    } else {
                        var matchFilter = true;
                        var result =
                            'value' in cursor ? cursor.value : cursor.key;

                        filters.forEach(function(filter) {
                            if (!filter || !filter.length) {
                                //Invalid filter do nothing
                            } else if (filter.length === 2) {
                                matchFilter =
                                    matchFilter &&
                                    result[filter[0]] === filter[1];
                            } else {
                                matchFilter =
                                    matchFilter &&
                                    filter[0].apply(undefined, [result]);
                            }
                        });

                        if (matchFilter) {
                            counter++;
                            results.push(mapper(result));
                            // if we're doing a modify, run it now
                            if (modifyObj) {
                                result = modifyRecord(result);
                                cursor.update(result);
                            }
                        }
                        cursor['continue']();
                    }
                }
            };

            return new Promise(function(resolve, reject) {
                transaction.oncomplete = function() {
                    resolve(results);
                };
                transaction.onerror = function(e) {
                    reject(e);
                };
                transaction.onabort = function(e) {
                    reject(e);
                };
            });
        };

        var Query = function(type, args) {
            var direction = 'next',
                cursorType = 'openCursor',
                filters = [],
                limitRange = null,
                mapper = defaultMapper,
                unique = false;

            var execute = function() {
                return runQuery(
                    type,
                    args,
                    cursorType,
                    unique ? direction + 'unique' : direction,
                    limitRange,
                    filters,
                    mapper
                );
            };

            var limit = function() {
                limitRange = Array.prototype.slice.call(arguments, 0, 2);
                if (limitRange.length == 1) {
                    limitRange.unshift(0);
                }

                return {
                    execute: execute,
                };
            };
            var count = function() {
                direction = null;
                cursorType = 'count';

                return {
                    execute: execute,
                };
            };
            var keys = function() {
                cursorType = 'openKeyCursor';

                return {
                    desc: desc,
                    execute: execute,
                    filter: filter,
                    distinct: distinct,
                    map: map,
                };
            };
            var filter = function() {
                filters.push(Array.prototype.slice.call(arguments, 0, 2));

                return {
                    keys: keys,
                    execute: execute,
                    filter: filter,
                    desc: desc,
                    distinct: distinct,
                    modify: modify,
                    limit: limit,
                    map: map,
                };
            };
            var desc = function() {
                direction = 'prev';

                return {
                    keys: keys,
                    execute: execute,
                    filter: filter,
                    distinct: distinct,
                    modify: modify,
                    map: map,
                };
            };
            var distinct = function() {
                unique = true;
                return {
                    keys: keys,
                    count: count,
                    execute: execute,
                    filter: filter,
                    desc: desc,
                    modify: modify,
                    map: map,
                };
            };
            var modify = function(update) {
                modifyObj = update;
                return {
                    execute: execute,
                };
            };
            var map = function(fn) {
                mapper = fn;

                return {
                    execute: execute,
                    count: count,
                    keys: keys,
                    filter: filter,
                    desc: desc,
                    distinct: distinct,
                    modify: modify,
                    limit: limit,
                    map: map,
                };
            };

            return {
                execute: execute,
                count: count,
                keys: keys,
                filter: filter,
                desc: desc,
                distinct: distinct,
                modify: modify,
                limit: limit,
                map: map,
            };
        };

        'only bound upperBound lowerBound'.split(' ').forEach(function(name) {
            that[name] = function() {
                return new Query(name, arguments);
            };
        });

        this.filter = function() {
            var query = new Query(null, null);
            return query.filter.apply(query, arguments);
        };

        this.all = function() {
            return this.filter();
        };
    };

    var createSchema = function(e, schema, db) {
        if (typeof schema === 'function') {
            schema = schema();
        }

        for (var tableName in schema) {
            var table = schema[tableName];
            var store;
            if (
                !hasOwn.call(schema, tableName) ||
                db.objectStoreNames.contains(tableName)
            ) {
                store = e.currentTarget.transaction.objectStore(tableName);
            } else {
                store = db.createObjectStore(tableName, table.key);
            }

            for (var indexKey in table.indexes) {
                var index = table.indexes[indexKey];
                try {
                    store.index(indexKey);
                } catch (e) {
                    store.createIndex(
                        indexKey,
                        index.key || indexKey,
                        Object.keys(index).length ? index : { unique: false }
                    );
                }
            }
        }
    };

    var open = function(e, server, version, schema) {
        var db = e.target.result;
        var s = new Server(db, server);
        var upgrade;

        dbCache[server] = db;

        return Promise.resolve(s);
    };

    var dbCache = {};

    var db = {
        version: '0.9.2',
        open: function(options) {
            var request;

            return new Promise(function(resolve, reject) {
                if (dbCache[options.server]) {
                    open(
                        {
                            target: {
                                result: dbCache[options.server],
                            },
                        },
                        options.server,
                        options.version,
                        options.schema
                    ).then(resolve, reject);
                } else {
                    request = getIndexedDB().open(
                        options.server,
                        options.version
                    );

                    request.onsuccess = function(e) {
                        open(
                            e,
                            options.server,
                            options.version,
                            options.schema
                        ).then(resolve, reject);
                    };

                    request.onupgradeneeded = function(e) {
                        createSchema(e, options.schema, e.target.result);
                    };
                    request.onerror = function(e) {
                        reject(e);
                    };
                }
            });
        },
    };

    // Export to global scope for service worker
    try {
        if (typeof globalScope !== 'undefined') {
            globalScope.db = db;
        }
    } catch (e) {
        console.error('Failed to export db to global scope:', e);
    }
})(self);
} catch (dbError) {
    console.error('Failed to initialize DB module:', dbError);
}

// ===== DBSERVICE.JS =====
var dbService = {
    DB_SERVER: 'spaces',
    DB_VERSION: '1',
    DB_SESSIONS: 'ttSessions',

    noop() {},

    /**
     * INDEXEDDB FUNCTIONS
     */
    getDb() {
        return db.open({
            server: dbService.DB_SERVER,
            version: dbService.DB_VERSION,
            schema: dbService.getSchema,
        });
    },

    /**
     * Properties of a session object
     * session.id:           auto-generated indexedDb object id
     * session.sessionHash:  a hash formed from the combined urls in the session window
     * session.name:         the saved name of the session
     * session.tabs:         an array of chrome tab objects (often taken from the chrome window obj)
     * session.history:      an array of chrome tab objects that have been removed from the session
     * session.lastAccess:   timestamp that gets updated with every window focus
     */
    getSchema() {
        return {
            ttSessions: {
                key: {
                    keyPath: 'id',
                    autoIncrement: true,
                },
                indexes: {
                    id: {},
                },
            },
        };
    },

    _fetchAllSessions() {
        return dbService.getDb().then(s => {
            return s
                .query(dbService.DB_SESSIONS)
                .all()
                .execute();
        });
    },

    _fetchSessionById: id => {
        const _id = typeof id === 'string' ? parseInt(id, 10) : id;
        return dbService.getDb().then(s => {
            return s
                .query(dbService.DB_SESSIONS, 'id')
                .only(_id)
                .distinct()
                .desc()
                .execute()
                .then(results => {
                    return results.length > 0 ? results[0] : null;
                });
        });
    },

    fetchAllSessions: callback => {
        const _callback =
            typeof callback !== 'function' ? dbService.noop : callback;
        dbService._fetchAllSessions().then(sessions => {
            _callback(sessions);
        });
    },

    fetchSessionById: (id, callback) => {
        const _id = typeof id === 'string' ? parseInt(id, 10) : id;
        const _callback =
            typeof callback !== 'function' ? dbService.noop : callback;
        dbService._fetchSessionById(_id).then(session => {
            _callback(session);
        });
    },

    fetchSessionNames: callback => {
        const _callback =
            typeof callback !== 'function' ? dbService.noop : callback;

        dbService._fetchAllSessions().then(sessions => {
            _callback(
                sessions.map(session => {
                    return session.name;
                })
            );
        });
    },

    fetchSessionByName: (sessionName, callback) => {
        const _callback =
            typeof callback !== 'function' ? dbService.noop : callback;

        dbService._fetchAllSessions().then(sessions => {
            let matchIndex;
            const matchFound = sessions.some((session, index) => {
                if (session.name.toLowerCase() === sessionName.toLowerCase()) {
                    matchIndex = index;
                    return true;
                }
                return false;
            });

            if (matchFound) {
                _callback(sessions[matchIndex]);
            } else {
                _callback(false);
            }
        });
    },

    createSession: (session, callback) => {
        const _callback =
            typeof callback !== 'function' ? dbService.noop : callback;

        // delete session id in case it already exists
        const { id, ..._session } = session;

        dbService
            .getDb()
            .then(s => {
                return s.add(dbService.DB_SESSIONS, _session);
            })
            .then(result => {
                if (result.length > 0) {
                    _callback(result[0]);
                }
            });
    },

    updateSession: (session, callback) => {
        const _callback =
            typeof callback !== 'function' ? dbService.noop : callback;

        // ensure session id is set
        if (!session.id) {
            _callback(false);
            return;
        }

        dbService
            .getDb()
            .then(s => {
                return s.update(dbService.DB_SESSIONS, session);
            })
            .then(result => {
                if (result.length > 0) {
                    _callback(result[0]);
                }
            });
    },

    removeSession: (id, callback) => {
        const _id = typeof id === 'string' ? parseInt(id, 10) : id;
        const _callback =
            typeof callback !== 'function' ? dbService.noop : callback;

        dbService
            .getDb()
            .then(s => {
                return s.remove(dbService.DB_SESSIONS, _id);
            })
            .then(_callback);
    },
};

// ===== UTILS.JS =====
console.log('Initializing utils module...');

// Use globalThis to ensure utils is available in service worker context
globalThis.utils = {
    getHashVariable: (key, urlStr) => {
        const valuesByKey = {};
        const keyPairRegEx = /^(.+)=(.+)/;

        if (!urlStr || urlStr.length === 0 || urlStr.indexOf('#') === -1) {
            return false;
        }

        // extract hash component from url
        const hashStr = urlStr.replace(/^[^#]+#+(.*)/, '$1');

        if (hashStr.length === 0) {
            return false;
        }

        hashStr.split('&').forEach(keyPair => {
            if (keyPair && keyPair.match(keyPairRegEx)) {
                valuesByKey[
                    keyPair.replace(keyPairRegEx, '$1')
                ] = keyPair.replace(keyPairRegEx, '$2');
            }
        });
        return valuesByKey[key] || false;
    },

    getSwitchKeycodes: callback => {
        chrome.runtime.sendMessage({ action: 'requestHotkeys' }, commands => {
            // eslint-disable-next-line no-console
            console.dir(commands);

            const commandStr = commands.switchCode;

            const keyStrArray = commandStr.split('+');

            // get keyStr of primary modifier
            const primaryModifier = keyStrArray[0];

            // get keyStr of secondary modifier
            const secondaryModifier =
                keyStrArray.length === 3 ? keyStrArray[1] : false;

            // get keycode of main key (last in array)
            const curStr = keyStrArray[keyStrArray.length - 1];

            // TODO: There's others. Period. Up Arrow etc.
            let mainKeyCode;
            if (curStr === 'Space') {
                mainKeyCode = 32;
            } else {
                mainKeyCode = curStr.toUpperCase().charCodeAt();
            }

            callback({
                primaryModifier,
                secondaryModifier,
                mainKeyCode,
            });
        });
    },
};

// Also create a var reference for backwards compatibility
var utils = globalThis.utils;

console.log('Utils module initialized:', !!utils, !!utils.getHashVariable);

// ===== SPACESSERVICE.JS =====
var spacesService = {
    tabHistoryUrlMap: {},
    closedWindowIds: {},
    sessions: [],
    sessionUpdateTimers: {},
    historyQueue: [],
    eventQueueCount: 0,
    lastVersion: 0,
    debug: false,

    noop: () => {},

    // initialise spaces - combine open windows with saved sessions
    initialiseSpaces: async () => {
        // update version numbers
        spacesService.lastVersion = await spacesService.fetchLastVersion();
        spacesService.setLastVersion(chrome.runtime.getManifest().version);

        dbService.fetchAllSessions(sessions => {
            if (
                chrome.runtime.getManifest().version === '0.18' &&
                chrome.runtime.getManifest().version !==
                    spacesService.lastVersion
            ) {
                spacesService.resetAllSessionHashes(sessions);
            }

            chrome.windows.getAll({ populate: true }, windows => {
                // populate session map from database
                spacesService.sessions = sessions;

                // clear any previously saved windowIds
                spacesService.sessions.forEach(session => {
                    // eslint-disable-next-line no-param-reassign
                    session.windowId = false;
                });

                // then try to match current open windows with saved sessions
                windows.forEach(curWindow => {
                    if (!spacesService.filterInternalWindows(curWindow)) {
                        spacesService.checkForSessionMatch(curWindow);
                    }
                });
            });
        });
    },

    resetAllSessionHashes: sessions => {
        sessions.forEach(session => {
            // eslint-disable-next-line no-param-reassign
            session.sessionHash = spacesService.generateSessionHash(
                session.tabs
            );
            dbService.updateSession(session);
        });
    },

    // record each tab's id and url so we can add history items when tabs are removed
    initialiseTabHistory: () => {
        chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
                spacesService.tabHistoryUrlMap[tab.id] = tab.url;
            });
        });
    },

    // NOTE: if ever changing this funciton, then we'll need to update all
    // saved sessionHashes so that they match next time, using: resetAllSessionHashes()
    _cleanUrl: url => {
        if (!url) {
            return '';
        }

        // ignore urls from this extension
        if (url.indexOf(chrome.runtime.id) >= 0) {
            return '';
        }

        // ignore 'new tab' pages
        if (url.indexOf('chrome:// newtab/') >= 0) {
            return '';
        }

        let cleanUrl = url;

        // add support for 'The Great Suspender'
        if (
            cleanUrl.indexOf('suspended.html') > 0 &&
            cleanUrl.indexOf('uri=') > 0
        ) {
            cleanUrl = cleanUrl.substring(
                cleanUrl.indexOf('uri=') + 4,
                cleanUrl.length
            );
        }

        // remove any text after a '#' symbol
        if (cleanUrl.indexOf('#') > 0) {
            cleanUrl = cleanUrl.substring(0, cleanUrl.indexOf('#'));
        }

        // remove any text after a '?' symbol
        if (cleanUrl.indexOf('?') > 0) {
            cleanUrl = cleanUrl.substring(0, cleanUrl.indexOf('?'));
        }

        return cleanUrl;
    },

    generateSessionHash: tabs => {
        const text = tabs.reduce((prevStr, tab) => {
            return prevStr + spacesService._cleanUrl(tab.url);
        }, '');

        let hash = 0;
        if (text.length === 0) return hash;
        for (let i = 0, len = text.length; i < len; i += 1) {
            const chr = text.charCodeAt(i);
            // eslint-disable-next-line no-bitwise
            hash = (hash << 5) - hash + chr;
            // eslint-disable-next-line no-bitwise
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    },

    filterInternalWindows: curWindow => {
        // sanity check to make sure window isnt an internal spaces window
        if (
            curWindow.tabs.length === 1 &&
            curWindow.tabs[0].url.indexOf(chrome.runtime.id) >= 0
        ) {
            return true;
        }

        // also filter out popup or panel window types
        if (curWindow.type === 'popup' || curWindow.type === 'panel') {
            return true;
        }
        return false;
    },

    checkForSessionMatch: curWindow => {
        if (!curWindow.tabs || curWindow.tabs.length === 0) {
            return;
        }

        const sessionHash = spacesService.generateSessionHash(curWindow.tabs);
        const temporarySession = spacesService.getSessionByWindowId(
            curWindow.id
        );
        const matchingSession = spacesService.getSessionBySessionHash(
            sessionHash,
            true
        );

        if (matchingSession) {
            if (spacesService.debug)
                // eslint-disable-next-line no-console
                console.log(
                    `matching session found: ${matchingSession.id}. linking with window: ${curWindow.id}`
                );

            spacesService.matchSessionToWindow(matchingSession, curWindow);
        }

        // if no match found and this window does not already have a temporary session
        if (!matchingSession && !temporarySession) {
            if (spacesService.debug)
                // eslint-disable-next-line no-console
                console.log(
                    `no matching session found. creating temporary session for window: ${curWindow.id}`
                );

            // create a new temporary session for this window (with no sessionId or name)
            spacesService.createTemporaryUnmatchedSession(curWindow);
        }
    },

    matchSessionToWindow: (session, curWindow) => {
        // remove any other sessions tied to this windowId (temporary sessions)
        for (let i = spacesService.sessions.length - 1; i >= 0; i -= 1) {
            if (spacesService.sessions[i].windowId === curWindow.id) {
                if (spacesService.sessions[i].id) {
                    spacesService.sessions[i].windowId = false;
                } else {
                    spacesService.sessions.splice(i, 1);
                }
            }
        }

        // assign windowId to newly matched session
        // eslint-disable-next-line no-param-reassign
        session.windowId = curWindow.id;
    },

    createTemporaryUnmatchedSession: curWindow => {
        if (spacesService.debug) {
            // eslint-disable-next-line no-console
            console.dir(spacesService.sessions);
            // eslint-disable-next-line no-console
            console.dir(curWindow);
        }

        const sessionHash = spacesService.generateSessionHash(curWindow.tabs);

        spacesService.sessions.push({
            id: false,
            windowId: curWindow.id,
            sessionHash,
            name: false,
            tabs: curWindow.tabs,
            history: [],
            lastAccess: new Date(),
        });
    },

    // local storage getters/setters
    fetchLastVersion: () => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['spacesVersion'], (result) => {
                resolve(result.spacesVersion || 0);
            });
        });
    },

    setLastVersion: newVersion => {
        chrome.storage.local.set({ spacesVersion: newVersion });
    },

    // event listener functions for window and tab events
    // (events are received and screened first in background.js)
    // -----------------------------------------------------------------------------------------

    handleTabRemoved: (tabId, removeInfo, callback) => {
        if (spacesService.debug)
            // eslint-disable-next-line no-console
            console.log(
                `handlingTabRemoved event. windowId: ${removeInfo.windowId}`
            );

        // NOTE: isWindowClosing is true if the window cross was clicked causing the tab to be removed.
        // If the tab cross is clicked and it is the last tab in the window
        // isWindowClosing will still be false even though the window will close
        if (removeInfo.isWindowClosing) {
            // be very careful here as we definitley do not want these removals being saved
            // as part of the session (effectively corrupting the session)

            // should be handled by the window removed listener
            spacesService.handleWindowRemoved(
                removeInfo.windowId,
                true,
                spacesService.noop
            );

            // if this is a legitimate single tab removal from a window then update session/window
        } else {
            spacesService.historyQueue.push({
                url: spacesService.tabHistoryUrlMap[tabId],
                windowId: removeInfo.windowId,
                action: 'add',
            });
            spacesService.queueWindowEvent(
                removeInfo.windowId,
                spacesService.eventQueueCount,
                callback
            );

            // remove tab from tabHistoryUrlMap
            delete spacesService.tabHistoryUrlMap[tabId];
        }
    },
    handleTabMoved: (tabId, moveInfo, callback) => {
        if (spacesService.debug)
            // eslint-disable-next-line no-console
            console.log(
                `handlingTabMoved event. windowId: ${moveInfo.windowId}`
            );
        spacesService.queueWindowEvent(
            moveInfo.windowId,
            spacesService.eventQueueCount,
            callback
        );
    },
    handleTabUpdated: (tab, changeInfo, callback) => {
        // NOTE: only queue event when tab has completed loading (title property exists at this point)
        if (tab.status === 'complete') {
            if (spacesService.debug)
                // eslint-disable-next-line no-console
                console.log(
                    `handlingTabUpdated event. windowId: ${tab.windowId}`
                );

            // update tab history in case the tab url has changed
            spacesService.tabHistoryUrlMap[tab.id] = tab.url;
            spacesService.queueWindowEvent(
                tab.windowId,
                spacesService.eventQueueCount,
                callback
            );
        }

        // check for change in tab url. if so, update history
        if (changeInfo.url) {
            // add tab to history queue as an item to be removed (as it is open for this window)
            spacesService.historyQueue.push({
                url: changeInfo.url,
                windowId: tab.windowId,
                action: 'remove',
            });
        }
    },
    handleWindowRemoved: (windowId, markAsClosed, callback) => {
        // ignore subsequent windowRemoved events for the same windowId (each closing tab will try to call this)
        if (spacesService.closedWindowIds[windowId]) {
            callback();
        }

        if (spacesService.debug)
            // eslint-disable-next-line no-console
            console.log(`handlingWindowRemoved event. windowId: ${windowId}`);

        // add windowId to closedWindowIds. the idea is that once a window is closed it can never be
        // rematched to a new session (hopefully these window ids never get legitimately re-used)
        if (markAsClosed) {
            if (spacesService.debug)
                // eslint-disable-next-line no-console
                console.log(`adding window to closedWindowIds: ${windowId}`);
            spacesService.closedWindowIds[windowId] = true;
            clearTimeout(spacesService.sessionUpdateTimers[windowId]);
        }

        const session = spacesService.getSessionByWindowId(windowId);
        if (session) {
            // if this is a saved session then just remove the windowId reference
            if (session.id) {
                session.windowId = false;

                // else if it is temporary session then remove the session from the cache
            } else {
                spacesService.sessions.some((curSession, index) => {
                    if (curSession.windowId === windowId) {
                        spacesService.sessions.splice(index, 1);
                        return true;
                    }
                    return false;
                });
            }
        }

        callback();
    },
    handleWindowFocussed: windowId => {
        if (spacesService.debug)
            // eslint-disable-next-line no-console
            console.log(`handlingWindowFocussed event. windowId: ${windowId}`);

        if (windowId <= 0) {
            return;
        }

        const session = spacesService.getSessionByWindowId(windowId);
        if (session) {
            session.lastAccess = new Date();
        }
    },

    // 1sec timer-based batching system.
    // Set a timeout so that multiple tabs all opened at once (like when restoring a session)
    // only trigger this function once (as per the timeout set by the last tab event)
    // This will cause multiple triggers if time between tab openings is longer than 1 sec
    queueWindowEvent: (windowId, eventId, callback) => {
        clearTimeout(spacesService.sessionUpdateTimers[windowId]);

        spacesService.eventQueueCount += 1;

        spacesService.sessionUpdateTimers[windowId] = setTimeout(() => {
            spacesService.handleWindowEvent(windowId, eventId, callback);
        }, 1000);
    },

    // careful here as this function gets called A LOT
    handleWindowEvent: (windowId, eventId, callback) => {
        // eslint-disable-next-line no-param-reassign
        callback =
            typeof callback !== 'function' ? spacesService.noop : callback;

        if (spacesService.debug)
            // eslint-disable-next-line no-console
            console.log('------------------------------------------------');
        if (spacesService.debug)
            // eslint-disable-next-line no-console
            console.log(
                `event: ${eventId}. attempting session update. windowId: ${windowId}`
            );

        // sanity check windowId
        if (!windowId || windowId <= 0) {
            if (spacesService.debug)
                // eslint-disable-next-line no-console
                console.log(
                    `received an event for windowId: ${windowId} which is obviously wrong`
                );
            return;
        }

        chrome.windows.get(windowId, { populate: true }, curWindow => {
            if (chrome.runtime.lastError) {
                // eslint-disable-next-line no-console
                console.log(
                    `${chrome.runtime.lastError.message}. perhaps its the development console???`
                );

                // if we can't find this window, then better remove references to it from the cached sessions
                // don't mark as a removed window however, so that the space can be resynced up if the window
                // does actually still exist (for some unknown reason)
                spacesService.handleWindowRemoved(
                    windowId,
                    false,
                    spacesService.noop
                );
                return;
            }

            if (!curWindow || spacesService.filterInternalWindows(curWindow)) {
                return;
            }

            // don't allow event if it pertains to a closed window id
            if (spacesService.closedWindowIds[windowId]) {
                if (spacesService.debug)
                    // eslint-disable-next-line no-console
                    console.log(
                        `ignoring event as it pertains to a closed windowId: ${windowId}`
                    );
                return;
            }

            // if window is associated with an open session then update session
            const session = spacesService.getSessionByWindowId(windowId);

            if (session) {
                if (spacesService.debug)
                    // eslint-disable-next-line no-console
                    console.log(
                        `tab statuses: ${curWindow.tabs
                            .map(curTab => {
                                return curTab.status;
                            })
                            .join('|')}`
                    );

                // look for tabs recently added/removed from this session and update session history
                const historyItems = spacesService.historyQueue.filter(
                    historyItem => {
                        return historyItem.windowId === windowId;
                    }
                );

                for (let i = historyItems.length - 1; i >= 0; i -= 1) {
                    const historyItem = historyItems[i];

                    if (historyItem.action === 'add') {
                        spacesService.addUrlToSessionHistory(
                            session,
                            historyItem.url
                        );
                    } else if (historyItem.action === 'remove') {
                        spacesService.removeUrlFromSessionHistory(
                            session,
                            historyItem.url
                        );
                    }
                    spacesService.historyQueue.splice(i, 1);
                }

                // override session tabs with tabs from window
                session.tabs = curWindow.tabs;
                session.sessionHash = spacesService.generateSessionHash(
                    session.tabs
                );

                // if it is a saved session then update db
                if (session.id) {
                    spacesService.saveExistingSession(session.id);
                }
            }

            // if no session found, it must be a new window.
            // if session found without session.id then it must be a temporary session
            // check for sessionMatch
            if (!session || !session.id) {
                if (spacesService.debug) {
                    // eslint-disable-next-line no-console
                    console.log('session check triggered');
                }
                spacesService.checkForSessionMatch(curWindow);
            }
            callback();
        });
    },

    // PUBLIC FUNCTIONS

    getSessionBySessionId: sessionId => {
        const result = spacesService.sessions.filter(session => {
            return session.id === sessionId;
        });
        return result.length === 1 ? result[0] : false;
    },
    getSessionByWindowId: windowId => {
        const result = spacesService.sessions.filter(session => {
            return session.windowId === windowId;
        });
        return result.length === 1 ? result[0] : false;
    },
    getSessionBySessionHash: (hash, closedOnly) => {
        const result = spacesService.sessions.filter(session => {
            if (closedOnly) {
                return session.sessionHash === hash && !session.windowId;
            }
            return session.sessionHash === hash;
        });
        return result.length >= 1 ? result[0] : false;
    },
    getSessionByName: name => {
        const result = spacesService.sessions.filter(session => {
            return (
                session.name &&
                session.name.toLowerCase() === name.toLowerCase()
            );
        });
        return result.length >= 1 ? result[0] : false;
    },
    getAllSessions: () => {
        return spacesService.sessions;
    },

    addUrlToSessionHistory: (session, newUrl) => {
        if (spacesService.debug) {
            // eslint-disable-next-line no-console
            console.log(`adding tab to history: ${newUrl}`);
        }

        const cleanUrl = spacesService._cleanUrl(newUrl);

        if (cleanUrl.length === 0) {
            return false;
        }

        // don't add removed tab to history if there is still a tab open with same url
        // note: assumes tab has NOT already been removed from session.tabs
        const tabBeingRemoved = session.tabs.filter(curTab => {
            return spacesService._cleanUrl(curTab.url) === cleanUrl;
        });

        if (tabBeingRemoved.length !== 1) {
            return false;
        }

        // eslint-disable-next-line no-param-reassign
        if (!session.history) session.history = [];

        // see if tab already exists in history. if so then remove it (it will be re-added)
        session.history.some((historyTab, index) => {
            if (spacesService._cleanUrl(historyTab.url) === cleanUrl) {
                session.history.splice(index, 1);
                return true;
            }
            return false;
        });

        // add url to session history
        // eslint-disable-next-line no-param-reassign
        session.history = tabBeingRemoved.concat(session.history);

        // trim history for this space down to last 200 items
        // eslint-disable-next-line no-param-reassign
        session.history = session.history.slice(0, 200);

        return session;
    },

    removeUrlFromSessionHistory: (session, newUrl) => {
        if (spacesService.debug) {
            // eslint-disable-next-line no-console
            console.log(`removing tab from history: ${newUrl}`);
        }

        // eslint-disable-next-line no-param-reassign
        newUrl = spacesService._cleanUrl(newUrl);

        if (newUrl.length === 0) {
            return;
        }

        // see if tab already exists in history. if so then remove it
        session.history.some((historyTab, index) => {
            if (spacesService._cleanUrl(historyTab.url) === newUrl) {
                session.history.splice(index, 1);
                return true;
            }
            return false;
        });
    },

    // Database actions

    updateSessionTabs: (sessionId, tabs, callback) => {
        const session = spacesService.getSessionBySessionId(sessionId);

        // eslint-disable-next-line no-param-reassign
        callback =
            typeof callback !== 'function' ? spacesService.noop : callback;

        // update tabs in session
        session.tabs = tabs;
        session.sessionHash = spacesService.generateSessionHash(session.tabs);

        spacesService.saveExistingSession(session.id, callback);
    },

    updateSessionName: (sessionId, sessionName, callback) => {
        // eslint-disable-next-line no-param-reassign
        callback =
            typeof callback !== 'function' ? spacesService.noop : callback;

        const session = spacesService.getSessionBySessionId(sessionId);
        session.name = sessionName;

        spacesService.saveExistingSession(session.id, callback);
    },

    saveExistingSession: (sessionId, callback) => {
        const session = spacesService.getSessionBySessionId(sessionId);

        // eslint-disable-next-line no-param-reassign
        callback =
            typeof callback !== 'function' ? spacesService.noop : callback;

        dbService.updateSession(session, callback);
    },

    saveNewSession: (sessionName, tabs, windowId, callback) => {
        if (!tabs) {
            callback();
            return;
        }

        const sessionHash = spacesService.generateSessionHash(tabs);
        let session;

        // eslint-disable-next-line no-param-reassign
        callback =
            typeof callback !== 'function' ? spacesService.noop : callback;

        // check for a temporary session with this windowId
        if (windowId) {
            session = spacesService.getSessionByWindowId(windowId);
        }

        // if no temporary session found with this windowId, then create one
        if (!session) {
            session = {
                windowId,
                history: [],
            };
            spacesService.sessions.push(session);
        }

        // update temporary session details
        session.name = sessionName;
        session.sessionHash = sessionHash;
        session.tabs = tabs;
        session.lastAccess = new Date();

        // save session to db
        dbService.createSession(session, savedSession => {
            // update sessionId in cache
            session.id = savedSession.id;

            callback(savedSession);
        });
    },

    deleteSession: (sessionId, callback) => {
        // eslint-disable-next-line no-param-reassign
        callback =
            typeof callback !== 'function' ? spacesService.noop : callback;

        dbService.removeSession(sessionId, () => {
            // remove session from cached array
            spacesService.sessions.some((session, index) => {
                if (session.id === sessionId) {
                    spacesService.sessions.splice(index, 1);
                    return true;
                }
                return false;
            });
            callback();
        });
    },
};

// ===== BACKGROUND.JS (ORIGINAL) =====
/* eslint-disable no-restricted-globals */
/* eslint-disable no-alert */

/* spaces
 * Copyright (C) 2015 Dean Oemcke
 */

// eslint-disable-next-line no-unused-vars, no-var
var spaces = (() => {
    let spacesPopupWindowId = false;
    let spacesOpenWindowId = false;
    const noop = () => {};
    const debug = false;
    const tabsToUnload = {};

    // LISTENERS

    // add listeners for session monitoring
    chrome.tabs.onCreated.addListener(tab => {
        // this call to checkInternalSpacesWindows actually returns false when it should return true
        // due to the event being called before the globalWindowIds get set. oh well, never mind.
        if (checkInternalSpacesWindows(tab.windowId, false)) return;
        // don't need this listener as the tabUpdated listener also fires when a new tab is created
        // spacesService.handleTabCreated(tab);
        updateSpacesWindow('tabs.onCreated');
    });
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        if (checkInternalSpacesWindows(removeInfo.windowId, false)) return;
        spacesService.handleTabRemoved(tabId, removeInfo, () => {
            updateSpacesWindow('tabs.onRemoved');
        });
    });
    chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
        if (checkInternalSpacesWindows(moveInfo.windowId, false)) return;
        spacesService.handleTabMoved(tabId, moveInfo, () => {
            updateSpacesWindow('tabs.onMoved');
        });
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (checkInternalSpacesWindows(tab.windowId, false)) return;

        if (tabsToUnload[tabId] === true) {
            // We can only discard the tab once its URL is updated, otherwise it's replaced with about:empty
            chrome.tabs.discard(tabId, discarded => {
                if (chrome.runtime.lastError) {
                    console.error(
                        'Error discarding tab: ',
                        chrome.runtime.lastError
                    );
                } else {
                    delete tabsToUnload[tabId];
                }
            });
        }

        spacesService.handleTabUpdated(tab, changeInfo, () => {
            updateSpacesWindow('tabs.onUpdated');
        });
    });
    chrome.windows.onRemoved.addListener(windowId => {
        if (checkInternalSpacesWindows(windowId, true)) return;
        spacesService.handleWindowRemoved(windowId, true, () => {
            updateSpacesWindow('windows.onRemoved');
        });

        // if this was the last window open and the spaces window is stil open
        // then close the spaces window also so that chrome exits fully
        // NOTE: this is a workaround for an issue with the chrome 'restore previous session' option
        // if the spaces window is the only window open and you try to use it to open a space,
        // when that space loads, it also loads all the windows from the window that was last closed
        chrome.windows.getAll({}, windows => {
            if (windows.length === 1 && spacesOpenWindowId) {
                chrome.windows.remove(spacesOpenWindowId);
            }
        });
    });
    // don't need this listener as the tabUpdated listener also fires when a new window is created
    // chrome.windows.onCreated.addListener(function (window) {

    //     if (checkInternalSpacesWindows(window.id, false)) return;
    //     spacesService.handleWindowCreated(window);
    // });

    // add listeners for tab and window focus changes
    // when a tab or window is changed, close the move tab popup if it is open
    chrome.windows.onFocusChanged.addListener(windowId => {
        // Prevent a click in the popup on Ubunto or ChroneOS from closing the
        // popup prematurely.
        if (
            windowId === chrome.windows.WINDOW_ID_NONE ||
            windowId === spacesPopupWindowId
        ) {
            return;
        }

        if (!debug && spacesPopupWindowId) {
            if (spacesPopupWindowId) {
                closePopupWindow();
            }
        }
        spacesService.handleWindowFocussed(windowId);
    });

    // add listeners for message requests from other extension pages (spaces.html & tab.html)

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (debug) {
            // eslint-disable-next-line no-console
            console.log(`listener fired: ${JSON.stringify(request)}`);
        }

        let sessionId;
        let windowId;
        let tabId;

        // Handle popup communication requests
        if (request.action === 'getBackgroundData') {
            try {
                // Check if service worker is fully initialized
                if (!isServiceWorkerInitialized) {
                    console.warn('Service worker not fully initialized yet, initialization state:', isServiceWorkerInitialized);
                    sendResponse({ error: 'Service worker still initializing, please try again in a moment' });
                    return true;
                }
                
                // Use globalThis to ensure we're getting the correct objects
                const utilsRef = globalThis.utils || utils;
                const spacesRef = globalThis.spaces || spaces;
                
                // Double-check all required components are available
                if (!utilsRef || !utilsRef.getHashVariable || !spacesRef || !spacesRef.requestHotkeys) {
                    console.error('Service worker components not available, details:', {
                        utils: !!utilsRef,
                        utilsGetHashVariable: !!(utilsRef && utilsRef.getHashVariable),
                        spaces: !!spacesRef,
                        spacesRequestHotkeys: !!(spacesRef && spacesRef.requestHotkeys),
                        globalUtils: !!globalThis.utils,
                        varUtils: !!utils,
                        globalSpaces: !!globalThis.spaces,
                        varSpaces: !!spaces,
                        isInitialized: isServiceWorkerInitialized
                    });
                    sendResponse({ error: 'Service worker components not properly initialized, please try again' });
                    return true;
                }
                
                console.log('Sending background data - utils:', !!utilsRef.getHashVariable, 'spaces:', !!spacesRef.requestHotkeys);
                
                // Don't send functions directly - they don't serialize properly
                // Instead, store references globally and send flags
                globalThis.backgroundUtils = utilsRef;
                globalThis.backgroundSpaces = spacesRef;
                
                sendResponse({
                    status: 'ready',
                    utilsAvailable: !!(utilsRef && utilsRef.getHashVariable),
                    spacesAvailable: !!(spacesRef && spacesRef.requestHotkeys)
                });
            } catch (error) {
                console.error('Error in getBackgroundData:', error);
                sendResponse({ error: error.message });
            }
            return true;
        }

        // Handle individual function calls from popup
        if (request.action === 'getHashVariable') {
            try {
                const utilsRef = globalThis.backgroundUtils || globalThis.utils || utils;
                const result = utilsRef.getHashVariable(request.key, request.urlStr);
                sendResponse({ result: result });
            } catch (error) {
                console.error('Error in getHashVariable:', error);
                sendResponse({ error: error.message });
            }
            return true;
        }

        if (request.action === 'getSwitchKeycodes') {
            try {
                const utilsRef = globalThis.backgroundUtils || globalThis.utils || utils;
                utilsRef.getSwitchKeycodes((result) => {
                    sendResponse({ result: result });
                });
            } catch (error) {
                console.error('Error in getSwitchKeycodes:', error);
                sendResponse({ error: error.message });
            }
            return true;
        }

        if (request.action === 'requestHotkeys') {
            try {
                const spacesRef = globalThis.backgroundSpaces || globalThis.spaces || spaces;
                spacesRef.requestHotkeys((result) => {
                    sendResponse({ result: result });
                });
            } catch (error) {
                console.error('Error in requestHotkeys:', error);
                sendResponse({ error: error.message });
            }
            return true;
        }

        if (request.action === 'generatePopupParams') {
            try {
                const spacesRef = globalThis.backgroundSpaces || globalThis.spaces || spaces;
                spacesRef.generatePopupParams(request.popupAction, request.tabUrl).then((result) => {
                    sendResponse({ result: result });
                }).catch((error) => {
                    console.error('Error in generatePopupParams:', error);
                    sendResponse({ error: error.message });
                });
            } catch (error) {
                console.error('Error in generatePopupParams:', error);
                sendResponse({ error: error.message });
            }
            return true;
        }

        if (request.action === 'requestSpaceFromWindowId') {
            try {
                const spacesRef = globalThis.backgroundSpaces || globalThis.spaces || spaces;
                spacesRef.requestSpaceFromWindowId(request.windowId, (result) => {
                    sendResponse({ result: result });
                });
            } catch (error) {
                console.error('Error in requestSpaceFromWindowId:', error);
                sendResponse({ error: error.message });
            }
            return true;
        }

        if (request.action === 'requestCurrentSpace') {
            try {
                const spacesRef = globalThis.backgroundSpaces || globalThis.spaces || spaces;
                spacesRef.requestCurrentSpace((result) => {
                    sendResponse({ result: result });
                });
            } catch (error) {
                console.error('Error in requestCurrentSpace:', error);
                sendResponse({ error: error.message });
            }
            return true;
        }

        // endpoints called by spaces.js
        switch (request.action) {
            case 'loadSession':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId) {
                    handleLoadSession(sessionId);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'loadWindow':
                windowId = _cleanParameter(request.windowId);
                if (windowId) {
                    handleLoadWindow(windowId);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'loadTabInSession':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId && request.tabUrl) {
                    handleLoadSession(sessionId, request.tabUrl);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'loadTabInWindow':
                windowId = _cleanParameter(request.windowId);
                if (windowId && request.tabUrl) {
                    handleLoadWindow(windowId, request.tabUrl);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'saveNewSession':
                windowId = _cleanParameter(request.windowId);
                if (windowId && request.sessionName) {
                    handleSaveNewSession(
                        windowId,
                        request.sessionName,
                        sendResponse
                    );
                }
                return true; // allow async response

            case 'importNewSession':
                if (request.urlList) {
                    handleImportNewSession(request.urlList, sendResponse);
                }
                return true; // allow async response

            case 'restoreFromBackup':
                if (request.spaces) {
                    handleRestoreFromBackup(request.spaces, sendResponse);
                }
                return true; // allow async response

            case 'deleteSession':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId) {
                    handleDeleteSession(sessionId, false, sendResponse);
                }
                return true;

            case 'updateSessionName':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId && request.sessionName) {
                    handleUpdateSessionName(
                        sessionId,
                        request.sessionName,
                        sendResponse
                    );
                }
                return true;

            case 'requestSpaceDetail':
                windowId = _cleanParameter(request.windowId);
                sessionId = _cleanParameter(request.sessionId);

                if (windowId) {
                    if (checkInternalSpacesWindows(windowId, false)) {
                        sendResponse(false);
                    } else {
                        requestSpaceFromWindowId(windowId, sendResponse);
                    }
                } else if (sessionId) {
                    requestSpaceFromSessionId(sessionId, sendResponse);
                }
                return true;

            // end points called by tag.js and switcher.js
            // note: some of these endpoints will close the requesting tab
            case 'requestAllSpaces':
                requestAllSpaces(allSpaces => {
                    sendResponse(allSpaces);
                });
                return true;

            case 'requestHotkeys':
                requestHotkeys(sendResponse);
                return true;

            case 'requestTabDetail':
                tabId = _cleanParameter(request.tabId);
                if (tabId) {
                    requestTabDetail(tabId, tab => {
                        if (tab) {
                            sendResponse(tab);
                        } else {
                            // close the requesting tab (should be tab.html)
                            closePopupWindow();
                        }
                    });
                }
                return true;

            case 'requestShowSpaces':
                windowId = _cleanParameter(request.windowId);

                // show the spaces tab in edit mode for the passed in windowId
                if (windowId) {
                    showSpacesOpenWindow(windowId, request.edit);
                } else {
                    showSpacesOpenWindow();
                }
                return false;

            case 'requestShowSwitcher':
                showSpacesSwitchWindow();
                return false;

            case 'requestShowMover':
                showSpacesMoveWindow();
                return false;

            case 'requestShowKeyboardShortcuts':
                createShortcutsWindow();
                return false;

            case 'requestClose':
                // close the requesting tab (should be tab.html)
                closePopupWindow();
                return false;

            case 'switchToSpace':
                windowId = _cleanParameter(request.windowId);
                sessionId = _cleanParameter(request.sessionId);

                if (windowId) {
                    handleLoadWindow(windowId);
                } else if (sessionId) {
                    handleLoadSession(sessionId);
                }

                return false;

            case 'addLinkToNewSession':
                tabId = _cleanParameter(request.tabId);
                if (request.sessionName && request.url) {
                    handleAddLinkToNewSession(
                        request.url,
                        request.sessionName,
                        result => {
                            if (result)
                                updateSpacesWindow('addLinkToNewSession');

                            // close the requesting tab (should be tab.html)
                            closePopupWindow();
                        }
                    );
                }
                return false;

            case 'moveTabToNewSession':
                tabId = _cleanParameter(request.tabId);
                if (request.sessionName && tabId) {
                    handleMoveTabToNewSession(
                        tabId,
                        request.sessionName,
                        result => {
                            if (result)
                                updateSpacesWindow('moveTabToNewSession');

                            // close the requesting tab (should be tab.html)
                            closePopupWindow();
                        }
                    );
                }
                return false;

            case 'addLinkToSession':
                sessionId = _cleanParameter(request.sessionId);

                if (sessionId && request.url) {
                    handleAddLinkToSession(request.url, sessionId, result => {
                        if (result) updateSpacesWindow('addLinkToSession');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            case 'moveTabToSession':
                sessionId = _cleanParameter(request.sessionId);
                tabId = _cleanParameter(request.tabId);

                if (sessionId && tabId) {
                    handleMoveTabToSession(tabId, sessionId, result => {
                        if (result) updateSpacesWindow('moveTabToSession');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            case 'addLinkToWindow':
                windowId = _cleanParameter(request.windowId);

                if (windowId && request.url) {
                    handleAddLinkToWindow(request.url, windowId, result => {
                        if (result) updateSpacesWindow('addLinkToWindow');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            case 'moveTabToWindow':
                windowId = _cleanParameter(request.windowId);
                tabId = _cleanParameter(request.tabId);

                if (windowId && tabId) {
                    handleMoveTabToWindow(tabId, windowId, result => {
                        if (result) updateSpacesWindow('moveTabToWindow');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            default:
                return false;
        }
    });
    function _cleanParameter(param) {
        if (typeof param === 'number') {
            return param;
        }
        if (param === 'false') {
            return false;
        }
        if (param === 'true') {
            return true;
        }
        return parseInt(param, 10);
    }

    // add listeners for keyboard commands

    chrome.commands.onCommand.addListener(command => {
        // handle showing the move tab popup (tab.html)
        if (command === 'spaces-move') {
            showSpacesMoveWindow();

            // handle showing the switcher tab popup (switcher.html)
        } else if (command === 'spaces-switch') {
            showSpacesSwitchWindow();
        }
    });

    // add context menu entry click listener (needs to be outside onInstalled)
    chrome.contextMenus.onClicked.addListener(info => {
        // handle showing the move tab popup (tab.html)
        if (info.menuItemId === 'spaces-add-link') {
            showSpacesMoveWindow(info.linkUrl);
        }
    });

    // runtime extension install listener
    chrome.runtime.onInstalled.addListener(details => {
        // Create context menu entry only on install/update
        chrome.contextMenus.create({
            id: 'spaces-add-link',
            title: 'Add link to space...',
            contexts: ['link'],
        });

        if (details.reason === 'install') {
            // eslint-disable-next-line no-console
            console.log('This is a first install!');
            showSpacesOpenWindow();
        } else if (details.reason === 'update') {
            const thisVersion = chrome.runtime.getManifest().version;
            if (details.previousVersion !== thisVersion) {
                // eslint-disable-next-line no-console
                console.log(
                    `Updated from ${details.previousVersion} to ${thisVersion}!`
                );
            }
        }
    });

    function createShortcutsWindow() {
        chrome.tabs.create({ url: 'chrome://extensions/configureCommands' });
    }

    function showSpacesOpenWindow(windowId, editMode) {
        let url;

        if (editMode && windowId) {
            url = chrome.runtime.getURL(
                `spaces.html#windowId=${windowId}&editMode=true`
            );
        } else {
            url = chrome.runtime.getURL('spaces.html');
        }

        // if spaces open window already exists then just give it focus (should be up to date)
        if (spacesOpenWindowId) {
            chrome.windows.get(
                spacesOpenWindowId,
                { populate: true },
                window => {
                    chrome.windows.update(spacesOpenWindowId, {
                        focused: true,
                    });
                    if (window.tabs[0].id) {
                        chrome.tabs.update(window.tabs[0].id, { url });
                    }
                }
            );

            // otherwise re-create it
        } else {
            chrome.windows.create(
                {
                    type: 'popup',
                    url,
                    height: 700,
                    width: 1000,
                    top: 0,
                    left: 0,
                },
                window => {
                    spacesOpenWindowId = window.id;
                }
            );
        }
    }
    function showSpacesMoveWindow(tabUrl) {
        createOrShowSpacesPopupWindow('move', tabUrl);
    }
    function showSpacesSwitchWindow() {
        createOrShowSpacesPopupWindow('switch');
    }

    async function generatePopupParams(action, tabUrl) {
        // get currently highlighted tab
        const tabs = await new Promise(resolve => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });
        if (tabs.length === 0) return '';

        const activeTab = tabs[0];

        // make sure that the active tab is not from an internal spaces window
        if (checkInternalSpacesWindows(activeTab.windowId, false)) {
            return '';
        }

        const session = spacesService.getSessionByWindowId(activeTab.windowId);

        const name = session ? session.name : '';

        let params = `action=${action}&windowId=${activeTab.windowId}&sessionName=${name}`;

        if (tabUrl) {
            params += `&url=${encodeURIComponent(tabUrl)}`;
        } else {
            params += `&tabId=${activeTab.id}`;
        }
        return params;
    }

    function createOrShowSpacesPopupWindow(action, tabUrl) {
        generatePopupParams(action, tabUrl).then(params => {
            const popupUrl = `${chrome.runtime.getURL(
                'popup.html'
            )}#opener=bg&${params}`;
            // if spaces  window already exists
            if (spacesPopupWindowId) {
                chrome.windows.get(
                    spacesPopupWindowId,
                    { populate: true },
                    window => {
                        // if window is currently focused then don't update
                        if (window.focused) {
                            // else update popupUrl and give it focus
                        } else {
                            chrome.windows.update(spacesPopupWindowId, {
                                focused: true,
                            });
                            if (window.tabs[0].id) {
                                chrome.tabs.update(window.tabs[0].id, {
                                    url: popupUrl,
                                });
                            }
                        }
                    }
                );

                // otherwise create it
            } else {
                chrome.windows.create(
                    {
                        type: 'popup',
                        url: popupUrl,
                        focused: true,
                        height: 450,
                        width: 310,
                        top: 50,
                        left: 50,
                    },
                    window => {
                        spacesPopupWindowId = window.id;
                    }
                );
            }
        });
    }

    function closePopupWindow() {
        if (spacesPopupWindowId) {
            chrome.windows.get(
                spacesPopupWindowId,
                { populate: true },
                spacesWindow => {
                    if (!spacesWindow) return;

                    // remove popup from history
                    if (
                        spacesWindow.tabs.length > 0 &&
                        spacesWindow.tabs[0].url
                    ) {
                        chrome.history.deleteUrl({
                            url: spacesWindow.tabs[0].url,
                        });
                    }

                    // remove popup window
                    chrome.windows.remove(spacesWindow.id, () => {
                        if (chrome.runtime.lastError) {
                            // eslint-disable-next-line no-console
                            console.log(chrome.runtime.lastError.message);
                        }
                    });
                }
            );
        }
    }

    function updateSpacesWindow(source) {
        if (debug)
            // eslint-disable-next-line no-console
            console.log(`updateSpacesWindow triggered. source: ${source}`);

        requestAllSpaces(allSpaces => {
            chrome.runtime.sendMessage({
                action: 'updateSpaces',
                spaces: allSpaces,
            });
        });
    }

    function checkInternalSpacesWindows(windowId, windowClosed) {
        if (windowId === spacesOpenWindowId) {
            if (windowClosed) spacesOpenWindowId = false;
            return true;
        }
        if (windowId === spacesPopupWindowId) {
            if (windowClosed) spacesPopupWindowId = false;
            return true;
        }
        return false;
    }

    function checkSessionOverwrite(session) {
        // make sure session being overwritten is not currently open
        if (session.windowId) {
            // alert not available in service worker, we'll use confirm dialogs in the UI instead
            console.log(`Session '${session.name}' is currently open and cannot be overwritten`);
            return false;
        }
        // For now, always allow overwrite - UI should handle confirmation
        return true;
    }

    function checkSessionDelete(session) {
        // For now, always allow delete - UI should handle confirmation
        return true;
    }

    function requestHotkeys(callback) {
        chrome.commands.getAll(commands => {
            let switchStr;
            let moveStr;
            let spacesStr;

            commands.forEach(command => {
                if (command.name === 'spaces-switch') {
                    switchStr = command.shortcut;
                } else if (command.name === 'spaces-move') {
                    moveStr = command.shortcut;
                } else if (command.name === 'spaces-open') {
                    spacesStr = command.shortcut;
                }
            });

            callback({
                switchCode: switchStr,
                moveCode: moveStr,
                spacesCode: spacesStr,
            });
        });
    }

    function requestTabDetail(tabId, callback) {
        chrome.tabs.get(tabId, callback);
    }

    function requestCurrentSpace(callback) {
        chrome.windows.getCurrent(window => {
            requestSpaceFromWindowId(window.id, callback);
        });
    }

    // returns a 'space' object which is essentially the same as a session object
    // except that includes space.sessionId (session.id) and space.windowId
    function requestSpaceFromWindowId(windowId, callback) {
        // first check for an existing session matching this windowId
        const session = spacesService.getSessionByWindowId(windowId);

        if (session) {
            callback({
                sessionId: session.id,
                windowId: session.windowId,
                name: session.name,
                tabs: session.tabs,
                history: session.history,
            });

            // otherwise build a space object out of the actual window
        } else {
            chrome.windows.get(windowId, { populate: true }, window => {
                // if failed to load requested window
                if (chrome.runtime.lastError) {
                    callback(false);
                } else {
                    callback({
                        sessionId: false,
                        windowId: window.id,
                        name: false,
                        tabs: window.tabs,
                        history: false,
                    });
                }
            });
        }
    }

    function requestSpaceFromSessionId(sessionId, callback) {
        const session = spacesService.getSessionBySessionId(sessionId);

        callback({
            sessionId: session.id,
            windowId: session.windowId,
            name: session.name,
            tabs: session.tabs,
            history: session.history,
        });
    }

    function requestAllSpaces(callback) {
        const sessions = spacesService.getAllSessions();
        const allSpaces = sessions
            .map(session => {
                return { sessionId: session.id, ...session };
            })
            .filter(session => {
                return session && session.tabs && session.tabs.length > 0;
            });

        // sort results
        allSpaces.sort(spaceDateCompare);

        callback(allSpaces);
    }

    function spaceDateCompare(a, b) {
        // order open sessions first
        if (a.windowId && !b.windowId) {
            return -1;
        }
        if (!a.windowId && b.windowId) {
            return 1;
        }
        // then order by last access date
        if (a.lastAccess > b.lastAccess) {
            return -1;
        }
        if (a.lastAccess < b.lastAccess) {
            return 1;
        }
        return 0;
    }

    function handleLoadSession(sessionId, tabUrl) {
        const session = spacesService.getSessionBySessionId(sessionId);

        // if space is already open, then give it focus
        if (session.windowId) {
            handleLoadWindow(session.windowId, tabUrl);
            return;
        }

        // else load space in new window
        const urls = session.tabs.map(curTab => {
            return curTab.url;
        });
        // ['chrome://newtab/'], // Use a placeholder URL or an empty array for a blank page
        chrome.windows.create(
            {
                url: urls[0], // just pass first url, since we want to load the rest of the tabs in discarded state
                height: 700,
                width: 1000,
                top: 0,
                left: 0,
            },
            newWindow => {
                // force match this new window to the session
                spacesService.matchSessionToWindow(session, newWindow);

                for (let i = 0; i < session.tabs.length; i++) {
                    if (i === 0) {
                        // ignore the first tab - should be already loaded
                        continue;
                    }
                    const curSessionTab = session.tabs[i];
                    chrome.tabs.create(
                        {
                            windowId: newWindow.id,
                            url: curSessionTab.url,
                            pinned: curSessionTab.pinned,
                            active: false,
                        },
                        tab => {
                            tabsToUnload[tab.id] = true;
                        }
                    );
                }

                // after window has loaded try to pin any previously pinned tabs
                session.tabs.forEach(curSessionTab => {
                    // curSessionTab.active = false;
                    if (curSessionTab.pinned) {
                        let pinnedTabId = false;
                        newWindow.tabs.some(curNewTab => {
                            if (
                                curNewTab.url === curSessionTab.url ||
                                curNewTab.pendingUrl === curSessionTab.url
                            ) {
                                pinnedTabId = curNewTab.id;
                                return true;
                            }
                            return false;
                        });
                        if (pinnedTabId) {
                            chrome.tabs.update(pinnedTabId, {
                                pinned: true,
                                // active: false,
                            });
                        }
                    }
                });

                // if tabUrl is defined, then focus this tab
                if (tabUrl) {
                    focusOrLoadTabInWindow(newWindow, tabUrl);
                }

                /*
                session.tabs.forEach(function (curTab) {
                    chrome.tabs.create({windowId: newWindow.id, url: curTab.url, pinned: curTab.pinned, active: false});
                });

                chrome.tabs.query({windowId: newWindow.id, index: 0}, function (tabs) {
                    chrome.tabs.remove(tabs[0].id);
                });
                */
            }
        );
    }
    function handleLoadWindow(windowId, tabUrl) {
        // assume window is already open, give it focus
        if (windowId) {
            focusWindow(windowId);
        }

        // if tabUrl is defined, then focus this tab
        if (tabUrl) {
            chrome.windows.get(windowId, { populate: true }, window => {
                focusOrLoadTabInWindow(window, tabUrl);
            });
        }
    }

    function focusWindow(windowId) {
        chrome.windows.update(windowId, { focused: true });
    }

    function focusOrLoadTabInWindow(window, tabUrl) {
        const match = window.tabs.some(tab => {
            if (tab.url === tabUrl) {
                chrome.tabs.update(tab.id, { active: true });
                return true;
            }
            return false;
        });
        if (!match) {
            chrome.tabs.create({ url: tabUrl });
            // chrome.tabs.create({url: "chrome://newtab/", active: false}, tab => {
            //     // Later, when you want to load the tab, update the URL
            //     chrome.tabs.update(tab.id, {url: tabUrl, active: true});
            // });
        }
    }

    function handleSaveNewSession(windowId, sessionName, callback) {
        chrome.windows.get(windowId, { populate: true }, curWindow => {
            const existingSession = spacesService.getSessionByName(sessionName);

            // if session with same name already exist, then prompt to override the existing session
            if (existingSession) {
                if (!checkSessionOverwrite(existingSession)) {
                    callback(false);
                    return;

                    // if we choose to overwrite, delete the existing session
                }
                handleDeleteSession(existingSession.id, true, noop);
            }
            spacesService.saveNewSession(
                sessionName,
                curWindow.tabs,
                curWindow.id,
                callback
            );
        });
    }

    function handleRestoreFromBackup(_spaces, callback) {
        let existingSession;
        let performSave;

        const promises = [];
        for (let i = 0; i < _spaces.length; i += 1) {
            const space = _spaces[i];
            existingSession = space.name
                ? spacesService.getSessionByName(space.name)
                : false;
            performSave = true;

            // if session with same name already exist, then prompt to override the existing session
            if (existingSession) {
                if (!checkSessionOverwrite(existingSession)) {
                    performSave = false;

                    // if we choose to overwrite, delete the existing session
                } else {
                    handleDeleteSession(existingSession.id, true, noop);
                }
            }

            if (performSave) {
                promises.push(
                    new Promise(resolve => {
                        spacesService.saveNewSession(
                            space.name,
                            space.tabs,
                            false,
                            resolve
                        );
                    })
                );
            }
        }
        Promise.all(promises).then(callback);
    }

    function handleImportNewSession(urlList, callback) {
        let tempName = 'Imported space: ';
        let count = 1;

        while (spacesService.getSessionByName(tempName + count)) {
            count += 1;
        }

        tempName += count;

        const tabList = urlList.map(text => {
            return { url: text };
        });

        // save session to database
        spacesService.saveNewSession(tempName, tabList, false, callback);
    }

    function handleUpdateSessionName(sessionId, sessionName, callback) {
        // check to make sure session name doesn't already exist
        const existingSession = spacesService.getSessionByName(sessionName);

        // if session with same name already exist, then prompt to override the existing session
        if (existingSession && existingSession.id !== sessionId) {
            if (!checkSessionOverwrite(existingSession)) {
                callback(false);
                return;

                // if we choose to override, then delete the existing session
            }
            handleDeleteSession(existingSession.id, true, noop);
        }
        spacesService.updateSessionName(sessionId, sessionName, callback);
    }

    function handleDeleteSession(sessionId, force, callback) {
        const session = spacesService.getSessionBySessionId(sessionId);
        if (!force && !checkSessionDelete(session)) {
            callback(false);
        } else {
            spacesService.deleteSession(sessionId, callback);
        }
    }

    function handleAddLinkToNewSession(url, sessionName, callback) {
        const session = spacesService.getSessionByName(sessionName);
        const newTabs = [{ url }];

        // if we found a session matching this name then return as an error as we are
        // supposed to be creating a new session with this name
        if (session) {
            callback(false);

            // else create a new session with this name containing this url
        } else {
            spacesService.saveNewSession(sessionName, newTabs, false, callback);
        }
    }

    function handleMoveTabToNewSession(tabId, sessionName, callback) {
        requestTabDetail(tabId, tab => {
            const session = spacesService.getSessionByName(sessionName);

            // if we found a session matching this name then return as an error as we are
            // supposed to be creating a new session with this name
            if (session) {
                callback(false);

                //  else create a new session with this name containing this tab
            } else {
                // remove tab from current window (should generate window events)
                chrome.tabs.remove(tab.id);

                // save session to database
                spacesService.saveNewSession(
                    sessionName,
                    [tab],
                    false,
                    callback
                );
            }
        });
    }

    function handleAddLinkToSession(url, sessionId, callback) {
        const session = spacesService.getSessionBySessionId(sessionId);
        const newTabs = [{ url }];

        // if we have not found a session matching this name then return as an error as we are
        // supposed to be adding the tab to an existing session
        if (!session) {
            callback(false);
            return;
        }
        // if session is currently open then add link directly
        if (session.windowId) {
            handleAddLinkToWindow(url, session.windowId, callback);

            // else add tab to saved session in database
        } else {
            // update session in db
            session.tabs = session.tabs.concat(newTabs);
            spacesService.updateSessionTabs(session.id, session.tabs, callback);
        }
    }

    function handleAddLinkToWindow(url, windowId, callback) {
        chrome.tabs.create({ windowId, url, active: false });

        // NOTE: this move does not seem to trigger any tab event listeners
        // so we need to update sessions manually
        spacesService.queueWindowEvent(windowId);

        callback(true);
    }

    function handleMoveTabToSession(tabId, sessionId, callback) {
        requestTabDetail(tabId, tab => {
            const session = spacesService.getSessionBySessionId(sessionId);
            const newTabs = [tab];

            // if we have not found a session matching this name then return as an error as we are
            // supposed to be adding the tab to an existing session
            if (!session) {
                callback(false);
            } else {
                // if session is currently open then move it directly
                if (session.windowId) {
                    moveTabToWindow(tab, session.windowId, callback);
                    return;
                }

                // else add tab to saved session in database
                // remove tab from current window
                chrome.tabs.remove(tab.id);

                // update session in db
                session.tabs = session.tabs.concat(newTabs);
                spacesService.updateSessionTabs(
                    session.id,
                    session.tabs,
                    callback
                );
            }
        });
    }

    function handleMoveTabToWindow(tabId, windowId, callback) {
        requestTabDetail(tabId, tab => {
            moveTabToWindow(tab, windowId, callback);
        });
    }
    function moveTabToWindow(tab, windowId, callback) {
        chrome.tabs.move(tab.id, { windowId, index: -1 });

        // NOTE: this move does not seem to trigger any tab event listeners
        // so we need to update sessions manually
        spacesService.queueWindowEvent(tab.windowId);
        spacesService.queueWindowEvent(windowId);

        callback(true);
    }

    return {
        requestSpaceFromWindowId,
        requestCurrentSpace,
        requestHotkeys,
        generatePopupParams,
    };
})();

// Ensure spaces is available globally
globalThis.spaces = spaces;
console.log('Spaces module initialized:', !!spaces, !!spaces.requestHotkeys);

// Handle service worker lifecycle events
chrome.runtime.onStartup.addListener(() => {
    console.log('Service worker startup');
    initializeExtension();
});

chrome.runtime.onSuspend.addListener(() => {
    console.log('Service worker suspending');
});

// Initialize the extension when service worker starts
function initializeExtension() {
    (async () => {
        try {
            console.log('Starting extension initialization...', {
                utils: !!utils,
                spacesService: !!spacesService,
                spaces: !!spaces,
                globalUtils: !!globalThis.utils,
                globalSpaces: !!globalThis.spaces
            });
            
            await spacesService.initialiseSpaces();
            spacesService.initialiseTabHistory();
            
            // Set the initialization flag
            isServiceWorkerInitialized = true;
            
            console.log('Extension initialized successfully', {
                utils: !!utils,
                spacesService: !!spacesService,
                spaces: !!spaces,
                utilsGetHashVariable: !!(utils && utils.getHashVariable),
                spacesRequestHotkeys: !!(spaces && spaces.requestHotkeys),
                globalUtils: !!globalThis.utils,
                globalSpaces: !!globalThis.spaces,
                globalUtilsGetHashVariable: !!(globalThis.utils && globalThis.utils.getHashVariable),
                globalSpacesRequestHotkeys: !!(globalThis.spaces && globalThis.spaces.requestHotkeys),
                isInitialized: isServiceWorkerInitialized
            });
        } catch (error) {
            console.error('Failed to initialize spaces service:', error);
        }
    })();
}

// Initialize immediately when service worker loads
try {
    initializeExtension();
} catch (error) {
    console.error('Failed to initialize extension:', error);
}

// Keep service worker alive when popup is open
let keepAlivePort;
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'keepAlive') {
        keepAlivePort = port;
        console.log('Keep alive connection established');
        
        port.onDisconnect.addListener(() => {
            console.log('Keep alive connection disconnected');
            keepAlivePort = null;
        });
    }
});

console.log('Service worker setup complete');
