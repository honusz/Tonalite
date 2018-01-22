# -*- mode: python -*-

block_cipher = None


a = Analysis(['tonalite.py'],
             pathex=['C:\\Users\\johnr\\Documents\\Tonalite'],
             binaries=[],
             datas=[
                 ('LICENSE', '.'),
                 ('README.md', '.'),
                 ('index.min.html', '.'),
                 ('app.min.html', '.'),
                 ('static', 'static'),
                 ('channelman.pyd', '.'),
                 ('docs/_build/html', 'docs')],
             hiddenimports=['engineio.async_aiohttp'],
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
          exclude_binaries=True,
          name='Tonalite',
          debug=False,
          strip=False,
          upx=True,
          console=True )
coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=False,
               name='tonalite')
