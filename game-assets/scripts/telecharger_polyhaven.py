"""Télécharge un lot de ressources CC0 depuis Poly Haven (api.polyhaven.com).

  python3 -I game-assets/scripts/telecharger_polyhaven.py game-assets/scripts/lot1.json game-assets/sources/polyhaven

Chaque ressource va dans son propre dossier. Un fichier CREDITS.md est tenu à
jour (auteurs, licence CC0, adresse de la ressource). Les fichiers déjà
présents avec la bonne taille ne sont pas retéléchargés.
"""

import json
import os
import sys
import urllib.request

UA = {"User-Agent": "urithi-asset-fetch"}
TEX_MAPS = ["Diffuse", "nor_gl", "Rough", "AO"]


def get_json(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA)))


def fetch(url, dest, size):
    if os.path.exists(dest) and os.path.getsize(dest) == size:
        return 0
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    if os.path.getsize(tmp) != size:
        raise RuntimeError(f"taille inattendue pour {url}")
    os.replace(tmp, dest)
    return size


def main(lot_path, out_dir, res="2k"):
    lot = json.load(open(lot_path))
    credits, total = [], 0
    for kind, names in (("hdri", lot["hdri"]), ("tex", lot["tex"]), ("model", lot["model"])):
        for name in names:
            files = get_json(f"https://api.polyhaven.com/files/{name}")
            info = get_json(f"https://api.polyhaven.com/info/{name}")
            folder = os.path.join(out_dir, name)
            if kind == "hdri":
                e = files["hdri"][res]["hdr"]
                total += fetch(e["url"], os.path.join(folder, f"{name}_{res}.hdr"), e["size"])
            elif kind == "tex":
                for m in TEX_MAPS:
                    if m in files and res in files[m]:
                        e = files[m][res]["jpg"]
                        total += fetch(e["url"], os.path.join(folder, os.path.basename(e["url"])), e["size"])
            else:
                g = files["gltf"][res]["gltf"]
                total += fetch(g["url"], os.path.join(folder, os.path.basename(g["url"])), g["size"])
                for rel, e in g.get("include", {}).items():
                    total += fetch(e["url"], os.path.join(folder, rel), e["size"])
            authors = ", ".join(info.get("authors", {}).keys())
            credits.append(f"| {name} | {info.get('name', name)} | {authors} | CC0 | https://polyhaven.com/a/{name} |")
            print(f"ok {name}", flush=True)
    with open(os.path.join(out_dir, "CREDITS.md"), "w") as f:
        f.write("# Ressources Poly Haven (CC0 1.0, domaine public)\n\n")
        f.write("| Identifiant | Nom | Auteurs | Licence | Adresse |\n|---|---|---|---|---|\n")
        f.write("\n".join(credits) + "\n")
    print(f"TOTAL téléchargé : {total / 1e6:.1f} Mo")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
