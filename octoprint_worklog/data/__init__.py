# coding=utf-8
from __future__ import absolute_import

__author__ = "Alexander Shvetsov <shv-box@mail.com>"
__license__ = "GNU Affero General Public License http://www.gnu.org/licenses/agpl.html"
__copyright__ = "Copyright (C) 2017 Sven Lohrmann - Released under terms of the AGPLv3 License"

import os
import sqlite3

class WorkLog(object):

    DB_VERSION = 1
    
    STATUS_UNDEFINED = -1
    STATUS_FAIL = 0
    STATUS_SUCCESS = 1
    
    def __init__(self, config):
        self._db_path = config["path"]
        self._client_id = config["clientId"]
        self._logger = config["logger"]
 
    def initialize(self):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        
        create_sql = """\
        CREATE TABLE IF NOT EXISTS jobs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id VARCHAR(36) NOT NULL,
            printer   TEXT,
            user      TEXT,
            file      TEXT NOT NULL,
            origin    TEXT NOT NULL,
            path      TEXT NOT NULL,
            start     INT  NOT NULL DEFAULT -1,
            end       INT  NOT NULL DEFAULT -1,
            status    INT  NOT NULL DEFAULT -1,
            notes     TEXT NOT NULL DEFAULT ""
        );

        CREATE TABLE IF NOT EXISTS modifications (
            table_name VARCHAR(255) NOT NULL, 
            action VARCHAR(255) NOT NULL, 
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, 
            PRIMARY KEY (table_name)
        );

        CREATE TABLE IF NOT EXISTS users (
            name VARCHAR(255) NOT NULL, 
            PRIMARY KEY (name)
        );
        
        CREATE TABLE IF NOT EXISTS printers (
            name VARCHAR(255) NOT NULL, 
            PRIMARY KEY (name)
        );
        
        CREATE TABLE IF NOT EXISTS actives (
            client_id VARCHAR(36) NOT NULL, 
            table_name VARCHAR(255) NOT NULL, 
            id VARCHAR(255) NOT NULL, 
            PRIMARY KEY (client_id, table_name)
        );
        
        CREATE TABLE IF NOT EXISTS version (
            id INTEGER NOT NULL
        );

        CREATE TRIGGER IF NOT EXISTS jobs_on_insert AFTER INSERT on "jobs"
            FOR EACH ROW BEGIN
                REPLACE INTO modifications (table_name, action) VALUES ('jobs','INSERT');
                REPLACE INTO actives (client_id, table_name, id) VALUES (new.client_id, 'jobs', new.id);
                INSERT OR IGNORE INTO users (name) VALUES (new.user);
                REPLACE INTO actives (client_id, table_name, id) VALUES (new.client_id, 'users', new.user);
                INSERT OR IGNORE INTO printers (name) VALUES (new.printer);
                REPLACE INTO actives (client_id, table_name, id) VALUES (new.client_id, 'printers', new.printer);
            END;
            
        CREATE TRIGGER IF NOT EXISTS jobs_on_delete AFTER DELETE on "jobs"
            FOR EACH ROW BEGIN
                REPLACE INTO modifications (table_name, action) VALUES ('jobs','DELETE');
                DELETE FROM actives WHERE client_id=old.client_id;
            END;

        CREATE TRIGGER IF NOT EXISTS jobs_on_update AFTER UPDATE on "jobs"
            FOR EACH ROW BEGIN
                REPLACE INTO modifications (table_name, action) VALUES ('jobs','UPDATE');
                DELETE FROM actives WHERE client_id=new.client_id AND new.status>=0;
                INSERT OR IGNORE INTO users (name) VALUES (new.user);
                REPLACE INTO actives (client_id, table_name, id) VALUES (new.client_id, 'users', new.user);
                INSERT OR IGNORE INTO printers (name) VALUES (new.printer);
                REPLACE INTO actives (client_id, table_name, id) VALUES (new.client_id, 'printers', new.printer);
            END;
        
        CREATE TRIGGER IF NOT EXISTS actives_on_insert AFTER INSERT on "actives"
            FOR EACH ROW BEGIN
                REPLACE INTO modifications (table_name, action) VALUES ('actives','INSERT');
            END;
            
        CREATE TRIGGER IF NOT EXISTS actives_on_delete AFTER DELETE on "actives"
            FOR EACH ROW BEGIN
                REPLACE INTO modifications (table_name, action) VALUES ('actives','DELETE');
            END;

        CREATE TRIGGER IF NOT EXISTS actives_on_update AFTER UPDATE on "actives"
            FOR EACH ROW BEGIN
                REPLACE INTO modifications (table_name, action) VALUES ('actives','UPDATE');
            END;

        CREATE TRIGGER IF NOT EXISTS actives_on_insert_user AFTER INSERT on "actives"
            FOR EACH ROW WHEN new.table_name='users' BEGIN
                INSERT OR IGNORE INTO users (name) VALUES (new.id);
            END;
        
        CREATE TRIGGER IF NOT EXISTS actives_on_insert_printer AFTER INSERT on "actives"
            FOR EACH ROW WHEN new.table_name='printers' BEGIN
                INSERT OR IGNORE INTO printers (name) VALUES (new.id);
            END;
        
        CREATE TRIGGER IF NOT EXISTS actives_on_update_user AFTER UPDATE on "actives"
            FOR EACH ROW WHEN new.table_name='users' BEGIN
                INSERT OR IGNORE INTO users (name) VALUES (new.id);
            END;
        
        CREATE TRIGGER IF NOT EXISTS actives_on_update_printer AFTER UPDATE on "actives"
            FOR EACH ROW WHEN new.table_name='printers' BEGIN
                INSERT OR IGNORE INTO printers (name) VALUES (new.id);
            END;
            
        CREATE INDEX IF NOT EXISTS idx_client_id ON jobs (client_id);
        
        CREATE INDEX IF NOT EXISTS idx_printer ON jobs (printer);
        
        CREATE INDEX IF NOT EXISTS idx_user ON jobs (user);
        
        CREATE INDEX IF NOT EXISTS idx_file ON jobs (file);

        CREATE INDEX IF NOT EXISTS idx_origin ON jobs (origin);

        """
        
        #~ CREATE VIEW IF NOT EXISTS v_jobs
        #~ AS
        #~ SELECT
            #~ *,
            #~ datetime(start, 'unixepoch', 'localtime') as f_start,
            #~ datetime(end, 'unixepoch', 'localtime') as f_end,
            #~ (cast(end AS INT) - cast(start as INT)) AS time
        #~ FROM jobs;
    
        cur.executescript(create_sql)
        
        # Check database version
        dbVersion = None
        cur.execute("SELECT id FROM version LIMIT 1")
        
        row = cur.fetchone()
        if row is None:
            cur.execute("INSERT INTO version (id) VALUES (?)", (self.DB_VERSION,))
            conn.commit()
            dbVersion = self.DB_VERSION
        else:
            dbVersion = row[0]
            
        #~ self._logger.info("db version: %s" % dbVersion)
        
        conn.close()
        
    def get_lastmodified(self):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        cur.execute("SELECT cast(strftime('%s', changed_at) as real) FROM modifications ORDER BY changed_at DESC LIMIT 1")
        row = cur.fetchone()
        conn.close()
        #~ self._logger.info("changed_at: %s" % row[0])
        return row[0]
        
    def get_jobs_lastmodified(self):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        cur.execute("SELECT cast(strftime('%s', changed_at) as real) FROM modifications WHERE table_name='jobs' LIMIT 1")
        row = cur.fetchone()
        conn.close()
        #~ self._logger.info("jobs changed_at: %s" % row[0])
        return row[0]
        
    def get_actives_lastmodified(self):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        cur.execute("SELECT cast(strftime('%s', changed_at) as real) FROM modifications  WHERE table_name='actives'LIMIT 1")
        row = cur.fetchone()
        conn.close()
        #~ self._logger.info("actives changed_at: %s" % row[0])
        return row[0]

        #~ with self.lock, self.conn.begin():
            #~ stmt = select([self.modifications.c.changed_at]).where(self.modifications.c.table_name == "jobs")
            #~ return self.conn.execute(stmt).scalar()

    def get_all_jobs(self):
        #~ self._logger.info("get_all_jobs")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM jobs ORDER BY id")
        result = self._result_to_dict(cur)
        conn.close()
        #~ self._logger.info("get_all_jobs: %s", (result,))
        return result
        #~ with self.lock, self.conn.begin():
            #~ stmt = select([self.jobs]).order_by(self.jobs.c.material, self.jobs.c.vendor)
            #~ result = self.conn.execute(stmt)
        #~ return self._result_to_dict(result)
        
    def get_job(self, identifier):
        #~ self._logger.info("get_job")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE (id=?)", (identifier,))
        result = self._result_to_dict(cur)
        conn.close()
        return result
        #~ with self.lock, self.conn.begin():
            #~ stmt = select([self.jobs]).where(self.jobs.c.id == identifier)\
                #~ .order_by(self.jobs.c.material, self.jobs.c.vendor)
            #~ result = self.conn.execute(stmt)
        #~ return self._result_to_dict(result, one=True)
        
    def get_active_job(self):
        #~ self._logger.info("get_active_job")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        sql = """\
        SELECT jobs.* 
        FROM jobs, actives
        WHERE jobs.id=actives.id 
            AND actives.table_name='jobs'
            AND actives.client_id=:clientId
            """
        cur.execute(sql, (self._client_id,))
        result = self._result_to_dict(cur, True)
        
        # may be request from other client
        if result == None:
            sql = """\
            SELECT jobs.* 
            FROM jobs, actives
            WHERE jobs.printer=actives.id 
                AND actives.table_name='printers'
                AND jobs.status=:undefined
                """
            cur.execute(sql, (self.STATUS_UNDEFINED,))
            result = self._result_to_dict(cur, True)

        conn.close()
        return result

    def create_job(self, data):
        #~ self._logger.info("create_job")
        conn = sqlite3.connect(self._db_path)
        sql = """\
        INSERT INTO jobs (client_id, printer, user, file, origin, path, start) 
        VALUES (:client_id, :printer, :user, :file, :origin, :path, :start)
        """
        cur = conn.cursor()
        cur.execute(sql, data)
        conn.commit()
        data["id"] = cur.lastrowid
        conn.close()
        return data
        #~ with self.lock, self.conn.begin():
            #~ stmt = insert(self.jobs)\
                #~ .values(vendor=data["printer"], material=data["user"], density=data["file"],
                        #~ diameter=data["start"])
            #~ result = self.conn.execute(stmt)
        #~ data["id"] = result.lastrowid
        #~ return data

    def update_job(self, identifier, data):
        #~ self._logger.info("create_job")
        conn = sqlite3.connect(self._db_path)
        data["id"] = identifier
        sql = """\
        UPDATE jobs 
        SET user=:user, end=:end, status=:status, notes=:notes 
        WHERE id=:id
        ORDER BY id DESC 
        LIMIT 1
        """
        cur = conn.cursor()
        cur.execute(sql, data)
        conn.commit()
        conn.close()
        return data
         #~ with self.lock, self.conn.begin():
            #~ stmt = update(self.jobs).where(self.jobs.c.id == identifier)\
                #~ .values(vendor=data["vendor"], material=data["material"], density=data["density"],
                        #~ diameter=data["diameter"])
            #~ self.conn.execute(stmt)
        #~ return data

    def get_all_users(self):
        #~ self._logger.info("get_all_users")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM users ORDER BY name")
        result = self._result_to_dict(cur)
        conn.close()
        #~ self._logger.info("get_all_users: %s", (result,))
        return result

    def get_user(self, name):
        #~ self._logger.info("get_user")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        if name == "@":
            sql = """\
            SELECT users.* 
            FROM users, actives
            WHERE users.name=actives.id 
                AND actives.table_name='users'
                AND actives.client_id=:clientId
                """
            cur.execute(sql, (self._client_id,))
            result = self._result_to_dict(cur, True)
        else:
            cur.execute("SELECT * FROM users WHERE name=:identifier", (name,))
            result = self._result_to_dict(cur)
            
        conn.close()
        #~ self._logger.info("get_all_users: %s", (result,))
        return result

    def get_all_printers(self):
        #~ self._logger.info("get_all_printers")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM printers ORDER BY name")
        result = self._result_to_dict(cur)
        conn.close()
        #~ self._logger.info("get_all_printers: %s", (result,))
        return result

    def get_printer(self, name):
        #~ self._logger.info("get_printer")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        result = None
        if name == "@":
            sql = """\
            SELECT printers.* 
            FROM printers, actives
            WHERE printers.name=actives.id 
                AND actives.table_name='printers'
                AND actives.client_id=:clientId
                """
            cur.execute(sql, (self._client_id,))
            result = self._result_to_dict(cur, True)
        else:
            cur.execute("SELECT * FROM printers WHERE name=:identifier", (name,))
            result = self._result_to_dict(cur)
            
        conn.close()
        #~ self._logger.info("get_all_printers: %s", (result,))
        return result

    def update_active(self, data):
        #~ self._logger.info("update_active")
        data["clientId"] = self._client_id
        conn = sqlite3.connect(self._db_path)
        sql = """\
        INSERT OR REPLACE INTO actives (client_id, table_name, id) 
        VALUES (:clientId, :table_name, :id)
        """
        cur = conn.cursor()
        cur.execute(sql, data)
        conn.commit()
        conn.close()
        return data
        
    def get_active_id(self, tableName):
        #~ self._logger.info("get_active_id")
        data = {
            "clientId" : self._client_id,
            "tableName": tableName
            }
        conn = sqlite3.connect(self._db_path)
        cur = conn.cursor()
        cur.execute("SELECT id WHERE client_id=:clientId AND table_name=:tableName", data)
        result = self._result_to_dict(cur)
        conn.close()
        return result
        
    def remove_active(self, data):
        #~ self._logger.info("remove_active")
        data["clientId"] = self._client_id
        conn = sqlite3.connect(self._db_path)
        sql = """\
        DELETE FROM actives
        WHERE (client_id=:clientId AND table_name=:table_name)
        """
        cur = conn.cursor()
        rows = cur.execute(sql, data).rowcount
        conn.commit()
        conn.close()
        return rows
        
    # helper

    def update_active_user(self, user):
        if user is None: 
            self.remove_active_user()
            return None
        data = {"table_name": "users", "id": user}
        return self.update_active(data)
                
    def update_active_printer(self, printer):
        if printer is None:
            self.remove_active_printer()
            return None
        data = {"table_name": "printers", "id": printer}
        return self.update_active(data)
        
    def remove_active_user(self):
        data = {"table_name": "users"}
        return self.remove_active(data)
               
    def remove_active_printer(self):
        data = {"table_name": "printers"}
        return self.remove_active(data)
               
    def _result_to_dict(self, result, one=False):
        if one:
            row = result.fetchone()
            return dict(row) if row is not None else None
        else:
            return [dict(row) for row in result.fetchall()]

