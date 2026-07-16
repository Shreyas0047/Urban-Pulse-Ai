import ctypes
import gc
import os
import sys

from ai_config import AI_MEMORY_BUDGET_MB, AI_MEMORY_CLEANUP_ENABLED, AI_MEMORY_RESERVE_MB


def current_rss_mb():
    """Return current resident memory on Linux without adding a monitoring dependency."""
    try:
        with open("/proc/self/statm", "r", encoding="ascii") as statm:
            resident_pages = int(statm.read().split()[1])
        return round(resident_pages * os.sysconf("SC_PAGE_SIZE") / (1024 * 1024), 1)
    except (FileNotFoundError, IndexError, OSError, TypeError, ValueError):
        return None


def memory_pressure():
    rss_mb = current_rss_mb()
    pressured = bool(
        AI_MEMORY_BUDGET_MB
        and rss_mb is not None
        and rss_mb >= max(1, AI_MEMORY_BUDGET_MB - AI_MEMORY_RESERVE_MB)
    )
    return {
        "rssMb": rss_mb,
        "budgetMb": AI_MEMORY_BUDGET_MB or None,
        "reserveMb": AI_MEMORY_RESERVE_MB,
        "pressured": pressured,
    }


def trim_process_memory():
    if not AI_MEMORY_CLEANUP_ENABLED:
        return current_rss_mb()

    gc.collect()
    if sys.platform.startswith("linux"):
        try:
            libc = ctypes.CDLL("libc.so.6")
            trim = libc.malloc_trim
            trim.argtypes = [ctypes.c_size_t]
            trim.restype = ctypes.c_int
            trim(0)
        except (AttributeError, OSError):
            pass
    return current_rss_mb()
