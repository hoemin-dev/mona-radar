"""Generate web PNG sizes; original 1254px artwork is never edited."""
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
output=root/'public/icons'
output.mkdir(parents=True,exist_ok=True)
for source,prefix in [('icon_1254_mono.png','midway'),('icon_1254.png','midway-green')]:
    with Image.open(root/'assets/icons'/source) as image:
        for size in [32,64,128,192,256]:
            image.resize((size,size),Image.Resampling.LANCZOS).save(output/f'{prefix}-{size}.png',optimize=True)
print('Generated PNG icons in public/icons.')
