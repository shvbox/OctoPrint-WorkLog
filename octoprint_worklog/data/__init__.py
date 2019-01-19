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
        self._current_job_id = None
 
    def initialize(self):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        
        create_sql = """\
        CREATE TABLE IF NOT EXISTS jobs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id    VARCHAR(36) NOT NULL,
            printer_name TEXT,
            user_name    TEXT,
            file         TEXT NOT NULL,
            origin       TEXT NOT NULL,
            file_path    TEXT NOT NULL,
            start_time   INT  NOT NULL DEFAULT -1,
            end_time     INT  NOT NULL DEFAULT -1,
            status       INT  NOT NULL DEFAULT -1,
            notes        TEXT NOT NULL DEFAULT ""
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

        CREATE VIEW IF NOT EXISTS v_jobs AS
            SELECT *, end_time - start_time AS duration
            FROM jobs;
        
        CREATE TRIGGER IF NOT EXISTS jobs_on_insert AFTER INSERT on "jobs"
            FOR EACH ROW BEGIN
                INSERT OR IGNORE INTO users (name) VALUES (new.user_name);
                INSERT OR IGNORE INTO printers (name) VALUES (new.printer_name);
                INSERT OR REPLACE INTO modifications (table_name, action) VALUES ('jobs','INSERT');
            END;
            
        CREATE TRIGGER IF NOT EXISTS jobs_on_delete AFTER DELETE on "jobs"
            FOR EACH ROW BEGIN
                INSERT OR REPLACE INTO modifications (table_name, action) VALUES ('jobs','DELETE');
            END;

        CREATE TRIGGER IF NOT EXISTS jobs_on_update AFTER UPDATE on "jobs"
            FOR EACH ROW BEGIN
                INSERT OR IGNORE INTO users (name) VALUES (new.user_name);
                INSERT OR IGNORE INTO printers (name) VALUES (new.printer_name);
                INSERT OR REPLACE INTO modifications (table_name, action) VALUES ('jobs','UPDATE');
            END;
 
        CREATE TRIGGER IF NOT EXISTS users_on_insert AFTER INSERT on "users"
            FOR EACH ROW BEGIN
                DELETE FROM modifications WHERE table_name='users';
                INSERT INTO modifications (table_name, action) VALUES ('users','INSERT');
            END;
            
        CREATE TRIGGER IF NOT EXISTS users_on_delete AFTER DELETE on "users"
            FOR EACH ROW BEGIN
                DELETE FROM modifications WHERE table_name='users';
                INSERT INTO modifications (table_name, action) VALUES ('users','DELETE');
            END;

        CREATE TRIGGER IF NOT EXISTS users_on_update AFTER UPDATE on "users"
            FOR EACH ROW BEGIN
                DELETE FROM modifications WHERE table_name='users';
                INSERT INTO modifications (table_name, action) VALUES ('users','UPDATE');
            END;
        
        CREATE TRIGGER IF NOT EXISTS printers_on_insert AFTER INSERT on "printers"
            FOR EACH ROW BEGIN
                DELETE FROM modifications WHERE table_name='printers';
                INSERT INTO modifications (table_name, action) VALUES ('printers','INSERT');
            END;
            
        CREATE TRIGGER IF NOT EXISTS printers_on_delete AFTER DELETE on "printers"
            FOR EACH ROW BEGIN
                DELETE FROM modifications WHERE table_name='printers';
                INSERT INTO modifications (table_name, action) VALUES ('printers','DELETE');
            END;

        CREATE TRIGGER IF NOT EXISTS printers_on_update AFTER UPDATE on "printers"
            FOR EACH ROW BEGIN
                DELETE FROM modifications WHERE table_name='printers';
                INSERT INTO modifications (table_name, action) VALUES ('printers','UPDATE');
            END;
        
        CREATE INDEX IF NOT EXISTS idx_client_id ON jobs (client_id);
        
        CREATE INDEX IF NOT EXISTS idx_printer_name ON jobs (printer_name);
        
        CREATE INDEX IF NOT EXISTS idx_user_name ON jobs (user_name);
        
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
        
    def get_table_lastmodified(self, table):
        conn = sqlite3.connect(self._db_path)
        cur  = conn.cursor()
        cur.execute("SELECT cast(strftime('%s', changed_at) as real) FROM modifications WHERE table_name=?", (table,))
        row = cur.fetchone()
        conn.close()
        #~ self._logger.info("jobs changed_at: %s" % row[0])
        return 0 if row is None else row[0]
        
    def get_jobs_lastmodified(self):
        return self.get_table_lastmodified("jobs")
        
    def get_users_lastmodified(self):
        return self.get_table_lastmodified("users")
        
    def get_printers_lastmodified(self):
        return self.get_table_lastmodified("printers")
        
    def get_all_jobs(self):
        #~ self._logger.info("get_all_jobs")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM v_jobs")
        result = self._result_to_dict(cur)
        conn.close()
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
        cur.execute("SELECT * FROM v_jobs WHERE id=?", (identifier,))
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

        result = None
        if not self._current_job_id is None:
            self._logger.info("get_active_job: id = %s" % self._current_job_id)
            cur.execute("SELECT * FROM jobs WHERE id=?", (self._current_job_id,))
            result = self._result_to_dict(cur, True)

        if result is None:
            self._logger.info("get_active_job: client_id = %s" % self._client_id)
            cur.execute("SELECT * FROM jobs WHERE client_id=? AND status=? LIMIT 1", (self._client_id, self.STATUS_UNDEFINED))
            result = self._result_to_dict(cur, True)
            if not result is None:
                 self._current_job_id = result.get("id")
                 self._logger.info("get_active_job: id > %s" % self._client_id)
            
        conn.close()
        return result

    def start_job(self, data):
        #~ self._logger.info("start_job")
        data["client_id"] = self._client_id
        sql = """\
        INSERT INTO jobs (client_id, printer_name, user_name, file, origin, file_path, start_time) 
        VALUES (:client_id, :printer, :user, :file, :origin, :path, :start)
        """
        conn = sqlite3.connect(self._db_path)
        cur = conn.cursor()
        cur.execute(sql, data)
        conn.commit()
        self._current_job_id = cur.lastrowid
        data["id"] = self._current_job_id
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
        data["id"] = identifier
        sql = """\
        UPDATE jobs 
        SET user_name=:user, end_time=:end, status=:status, notes=:notes 
        WHERE id=:id
        ORDER BY id DESC 
        LIMIT 1
        """
        conn = sqlite3.connect(self._db_path)
        cur = conn.cursor()
        cur.execute(sql, data)
        conn.commit()
        conn.close()
        self._current_job_id = None
        return data
         #~ with self.lock, self.conn.begin():
            #~ stmt = update(self.jobs).where(self.jobs.c.id == identifier)\
                #~ .values(vendor=data["vendor"], material=data["material"], density=data["density"],
                        #~ diameter=data["diameter"])
            #~ self.conn.execute(stmt)
        #~ return data

    def get_job_totals(self, conditions):
        sql = """\
        SELECT 
            COUNT(id) AS total_quantity,
            SUM(CASE WHEN (end_time < start_time) THEN 0 ELSE end_time - start_time END) AS total_duration
        FROM v_jobs
        WHERE (CASE WHEN :user IS NULL THEN 1 ELSE user_name=:user END)
            AND (CASE WHEN :printer IS NULL THEN 1 ELSE printer_name=:printer END)
            AND (CASE WHEN :status IS NULL THEN 1 ELSE status=:status END)
            AND (CASE WHEN :begin IS NULL THEN 1 ELSE start_time>=:begin END)
            AND (CASE WHEN :end IS NULL THEN 1 ELSE start_time<:end END)
        """
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql, conditions)
        result = self._result_to_dict(cur, True)
        conn.close()
        return result
        
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
        result = self._result_to_dict(cur, True)
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
        result = self._result_to_dict(cur, True)
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

