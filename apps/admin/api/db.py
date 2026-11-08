"""PostgreSQL connection for the admin, shaped like the sqlite3 API the accounting code is written
against: conn.execute(sql, params) with ? placeholders, rows readable by name or position,
cursor.lastrowid, `with conn:` as a transaction.

All admin tables live in their own schema (default "admin"), so they never mix with the website's
Prisma tables in the same database.
"""
import re
from datetime import date, datetime
from decimal import Decimal

import psycopg
from psycopg import sql as pgsql

_INSERT = re.compile(r"^\s*INSERT\b", re.I)


class Row(tuple):
    """A result row: row["column"], row[0], dict(row) and tuple unpacking all work."""

    def __new__(cls, values, names):
        row = super().__new__(cls, values)
        row._names = names
        return row

    def keys(self):
        return list(self._names)

    def __getitem__(self, key):
        if isinstance(key, str):
            try:
                return tuple.__getitem__(self, self._names.index(key))
            except ValueError:
                raise KeyError(key) from None
        return tuple.__getitem__(self, key)

    def get(self, key, default=None):
        return self[key] if key in self._names else default


def _row_factory(cursor):
    names = [d.name for d in cursor.description] if cursor.description else []
    return lambda values: Row(values, names)


def _param(v):
    # SQLite stored everything as text; keep the same values going in.
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return str(v)
    return v


def _translate(query: str) -> str:
    """? placeholders -> %s (a literal % in SQL becomes %%)."""
    return query.replace("%", "%%").replace("?", "%s")


class Cursor:
    def __init__(self, cur, lastrowid=None):
        self._cur = cur
        self.lastrowid = lastrowid
        self.rowcount = cur.rowcount

    def fetchone(self):
        return self._cur.fetchone() if self._cur.description else None

    def fetchall(self):
        return self._cur.fetchall() if self._cur.description else []

    def __iter__(self):
        return iter(self.fetchall())


class Connection:
    def __init__(self, url: str, schema: str = "admin"):
        self.schema = schema
        self._pg = psycopg.connect(url, autocommit=True, row_factory=_row_factory)
        self._pg.execute(pgsql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(pgsql.Identifier(schema)))
        self._pg.execute(pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema)))
        self._tx = []

    def execute(self, query: str, params=()):
        params = tuple(_param(p) for p in params)
        q = _translate(query)
        returning = _INSERT.match(q) and "RETURNING" not in q.upper()
        cur = self._pg.execute(q + " RETURNING *" if returning else q, params or None)
        lastrowid = None
        if returning and cur.description:
            first = cur.fetchone()
            lastrowid = first.get("id") if first else None
        return Cursor(cur, lastrowid)

    def executemany(self, query: str, seq):
        with self._pg.cursor() as cur:
            cur.executemany(_translate(query), [tuple(_param(p) for p in params) for params in seq])

    def executescript(self, script: str):
        self._pg.execute(script)

    def commit(self):  # autocommit, or committed when `with conn:` ends
        pass

    def close(self):
        self._pg.close()

    def __enter__(self):
        tx = self._pg.transaction()
        tx.__enter__()
        self._tx.append(tx)
        return self

    def __exit__(self, *exc):
        return self._tx.pop().__exit__(*exc)


def connect(url: str, schema: str = "admin") -> Connection:
    return Connection(url, schema)
