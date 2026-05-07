# EmlékSúgó 2.5.0 build notes

Készült: 2026-05-06

## Javítások

- Verziószám frissítve: 2.5.0.
- A Vite belépési pontok újra a forrásfájlokra mutatnak:
  - `index.html` -> `/src/main.js`
  - `display.html` -> `/src/display.js`
- A CSS importok bekerültek a megfelelő JS belépési pontokba.
- A Display2 szövegméret és pozíció vezérlők HTML/JS azonosítói össze lettek hangolva.
- Bekötve a `Köv. dal eleje` gomb és a `PageDown` billentyű.
- A projektmentés alapértelmezett kiterjesztése `.esp`.
- A projektmentés Tauri alatt a natív Rust `es_save_project_as` parancsot használja, böngészős fallbackkel.
- A macOS GitHub Actions artifact nevek 2.5.0-ra frissültek.
- Visszaállítva a háttérképes Display2 megjelenés.
- Visszaállítva/kibővítve a Display2 oldalsó blokk-sáv.
- A főablak preview már ugyanazt a `display.html` renderert mutatja kicsinyítve, mint a második kijelző, így a scroll sebessége és az aktuális megjelenés azonos kódból fut.
- Mindkét kijelző kapott saját ablakvezérlőket: tálcára rejtés, ablak/teljes képernyő váltás, bezárás.
- Beépült a `Súgó megnyitása` gomb és egy 2.5.0-s súgó ablak.
- A korábbi gyors súgó PDF beépített referenciaként elérhető a telepített programból.

## Elkészült Windows csomagok

- `src-tauri/target/release/bundle/nsis/EmlékSúgó_2.5.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/EmlékSúgó_2.5.0_x64_en-US.msi`

## Megjegyzés a későbbi patch installerhez

Ehhez a 2.5.0-s buildhez már stabilabb alap van, de a valódi patch/update installerhez a következő lépésben érdemes külön update-stratégiát rögzíteni:

- meglévő telepítés felismerése,
- user data/projektfájlok megőrzése,
- repair/update/uninstall ágak,
- verzió-összehasonlítás,
- rollback vagy backup telepítés előtt.
- 2026-05-06 utolagos javitas: a kovetkezo/elozo blokk vezerles Display2 szinkronja robusztusabb lett, a foablak preview kozvetlen mini Display2 nezetet kapott, es visszakerult a megszolalo nevenek meret- es pozicioallitasa.
- 2026-05-06 hotfix 2.5.1: a Display2 blokk-sav elemei kattinthatok, scroll modban a blokkugras a tenyleges lejatszasi poziciot is a blokkhoz allitja, es az installer verzio 2.5.1-re emelkedett a biztos frissiteshez.
