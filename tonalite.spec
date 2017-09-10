# -*- mode: python -*-

block_cipher = None

added_files = [
    ( 'static', 'static' ),
    ( 'app.html', '.' ),
]
a = Analysis(['tonalite.py'],
             pathex=['C:\\Users\\johnr\\Documents\\Tonalite'],
             binaries=[],
             datas = added_files,
             hiddenimports=[],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          a.binaries,
          a.zipfiles,
          a.datas,
          name='tonalite',
          debug=False,
          strip=False,
          upx=True,
          runtime_tmpdir=None,
          console=True )

app = BUNDLE(exe,
         name='tonalite.app',
         icon=None,
         bundle_identifier=None)
