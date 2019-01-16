# coding=utf-8
from __future__ import absolute_import

__author__ = "Alexander Shvetsov <shv-box@mail.com>"
__license__ = "GNU Affero General Public License http://www.gnu.org/licenses/agpl.html"
__copyright__ = "Copyright (C) 2017 Sven Lohrmann - Released under terms of the AGPLv3 License"

import os
import sqlite3
import octoprint.printer.profile

class WorkLog(object):

    DB_VERSION = 1
    
    STATUS_UNDEFINED = -1
    STATUS_FAIL = 0
    STATUS_SUCCESS = 1
    
    def __init__(self, config):
        self._db_path = config["path"]
        self._logger = config["logger"]
 
    def initialize(self):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        
        create_sql = """\
        CREATE TABLE IF NOT EXISTS jobs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
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
        
        CREATE TABLE IF NOT EXISTS version (
            id INTEGER NOT NULL
        );

        CREATE TRIGGER IF NOT EXISTS jobs_on_insert AFTER INSERT on "jobs"
            FOR EACH ROW BEGIN
                REPLACE INTO modifications (table_name, action) VALUES ('jobs','INSERT');
                INSERT OR IGNORE INTO users (name) VALUES (new.user);
                INSERT OR IGNORE INTO printers (name) VALUES (new.printer);
            END;
            
        CREATE TRIGGER IF NOT EXISTS jobs_on_delete AFTER DELETE on "jobs"
            FOR EACH ROW BEGIN
                INSERT OR REPLACE INTO modifications (table_name, action) VALUES ('jobs','DELETE');
            END;

        CREATE TRIGGER IF NOT EXISTS jobs_on_update AFTER UPDATE on "jobs"
            FOR EACH ROW BEGIN
                INSERT OR REPLACE INTO modifications (table_name, action) VALUES ('jobs','UPDATE');
                INSERT OR IGNORE INTO users (name) VALUES (new.user);
                INSERT OR IGNORE INTO printers (name) VALUES (new.printer);
            END;
        
        CREATE INDEX IF NOT EXISTS idx_printer ON jobs (printer);
        
        CREATE INDEX IF NOT EXISTS idx_user ON jobs (user);
        
        CREATE INDEX IF NOT EXISTS idx_file ON jobs (file);

        CREATE INDEX IF NOT EXISTS idx_origin ON jobs (origin);

        """
        
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
        return 0 if row is None else row[0]
        
    def get_jobs_lastmodified(self):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        cur.execute("SELECT cast(strftime('%s', changed_at) as real) FROM modifications WHERE table_name='jobs' LIMIT 1")
        row = cur.fetchone()
        conn.close()
        #~ self._logger.info("jobs changed_at: %s" % row[0])
        return row[0]
        
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

    
    def get_active_job(self, printer):
        #~ self._logger.info("get_active_job")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE printer=? AND status=?", (printer, self.STATUS_UNDEFINED))
        result = self._result_to_dict(cur, True)
        conn.close()
        return result

    def start_job(self, data):
        #~ self._logger.info("start_job")
        conn = sqlite3.connect(self._db_path)
        sql = """\
        INSERT INTO jobs (printer, user, file, origin, path, start) 
        VALUES (:printer, :user, :file, :origin, :path, :start)
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

    def finish_job(self, identifier, data):
        #~ self._logger.info("finish_job")
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
        cur.execute("SELECT * FROM users WHERE name=?", (name,))
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
        cur.execute("SELECT * FROM printers WHERE name=?", (name,))
        result = self._result_to_dict(cur)
        conn.close()
        #~ self._logger.info("get_all_printers: %s", (result,))
        return result
        
    # helper

    def _result_to_dict(self, result, one=False):
        if one:
            row = result.fetchone()
            return dict(row) if row is not None else None
        else:
            return [dict(row) for row in result.fetchall()]

