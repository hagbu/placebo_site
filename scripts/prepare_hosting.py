from pathlib import Path
import shutil

root = Path(__file__).resolve().parent.parent
public = root / "public"
public.mkdir(exist_ok=True)

# מסירים רק עותקי חדרים ישנים, כדי שלא יישארו בפרסום מקומי קודם.
for room in ("monastery", "throne", "protectors", "super-clasico", "social-media"):
    for version in (1, 2):
        (public / f"{room}-{version}.html").unlink(missing_ok=True)

for pattern in ("*.html", "*.css", "*.js", "favicon.ico", "favicon.png"):
    for source in root.glob(pattern):
        shutil.copy2(source, public / source.name)

for name in ("css", "images", "videos"):
    shutil.copytree(root / name, public / name, dirs_exist_ok=True)

print("Site files copied to public.")
