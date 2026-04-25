from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    try:
        from PySide6.QtWidgets import QApplication
    except ImportError:
        print("PySide6 nie jest zainstalowane. Zainstaluj zaleznosci z requirements.txt.")
        return 1

    from src.ui.main_window import MainWindow

    app = QApplication(sys.argv)
    window = MainWindow(project_root=Path(__file__).resolve().parent)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())

