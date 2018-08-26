del channelman.c
del channelman.cp36-win_amd64.pyd
rmdir build /s
python3 setup.py build_ext --inplace
copy channelman.cp36-win_amd64.pyd ..\channelman.pyd