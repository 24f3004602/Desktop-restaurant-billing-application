from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    CASHIER = "cashier"
    WAITER = "waiter"
