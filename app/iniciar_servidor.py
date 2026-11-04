"""Inicia o app local em uma porta livre e abre o navegador padrão."""
from __future__ import annotations

import os
import socket
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

APP_DIR = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT_RANGE = range(8000, 8011)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[HTTP] {self.address_string()} - {fmt % args}")


def existing_app_url() -> str | None:
    """Reutiliza a instância anterior para preservar a origem e o LocalStorage."""
    base = "http://localhost:8000/"
    try:
        with urlopen(base, timeout=0.8) as response:
            page = response.read(200_000).decode("utf-8", errors="replace")
        with urlopen(base + "src/boot.js", timeout=0.8) as response:
            boot = response.read(100_000).decode("utf-8", errors="replace")
        if "Mercado" in page and "Inicializador clássico v1.4.0" in boot:
            return base
    except (OSError, URLError, TimeoutError):
        return None
    return None


def find_free_port() -> int:
    for port in PORT_RANGE:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((HOST, port))
                return port
            except OSError:
                continue
    raise RuntimeError("Nenhuma porta livre entre 8000 e 8010. Feche outro servidor local e tente novamente.")


def main() -> None:
    os.chdir(APP_DIR)
    active_url = existing_app_url()
    if active_url:
        print("O aplicativo já está em execução na porta 8000. Reutilizando a sessão existente.")
        print(f"Endereço: {active_url}")
        webbrowser.open(active_url + "atualizar-cache.html")
        return

    port = find_free_port()
    server = ThreadingHTTPServer(
        (HOST, port),
        lambda *args, **kwargs: QuietHandler(*args, directory=str(APP_DIR), **kwargs)
    )
    url = f"http://localhost:{port}/"

    print("=" * 60)
    print(" MERCADO & FINANÇAS — SERVIDOR LOCAL")
    print(f" Endereço: {url}")
    print(" O navegador atualizará o cache antigo antes de abrir o app.")
    print(" Mantenha esta janela aberta enquanto utilizar o aplicativo.")
    print(" Para encerrar, pressione Ctrl + C.")
    print("=" * 60)

    threading.Timer(0.8, lambda: webbrowser.open(url + "atualizar-cache.html")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Não foi possível iniciar o aplicativo: {exc}")
        input("Pressione Enter para sair...")
