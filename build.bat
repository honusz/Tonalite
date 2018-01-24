cd docs && gtitbook pdf . Tonalite-Documentation.pdf && cd ../
cd src_channelman && build.bat && cd ../ && python3 -m PyInstaller tonalite.spec
