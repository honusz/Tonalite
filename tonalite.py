import socketio
import webbrowser

import pickle

from aiohttp import web
from sACN import DMXSource

sio = socketio.AsyncServer(async_mode='aiohttp')
app = web.Application()
sio.attach(app)

fixtures = []
submasters = []
channels = [0] * 48
cues = []
show = {
    "name": None,
    "description": None,
    "authior": None,
    "copyright": None,
    "last_updated": None,
    "fixtures": [],
    "cues": []
}

async def index(request):
    with open('app.html') as f:
        return web.Response(text=f.read(), content_type='text/html')

async def saveshow(request):
        return web.Response(body=pickle.dumps([fixtures, submasters, cues, show], pickle.HIGHEST_PROTOCOL), headers={'Content-Disposition': 'attachment; filename="f.tonalite"'}, content_type='application/octet-stream')

app.router.add_static('/static', 'static')
app.router.add_get('/', index)
app.router.add_get('/show', saveshow)

def server(app_ip, app_port, sacn_ip):
    if app_ip == "":
        app_ip = "127.0.0.1"
    if app_port == "":
        app_port = "9898"
    if sacn_ip == "":
        sacn_ip = "127.0.0.1"

    source = DMXSource(universe=1, net_ip=sacn_ip)
    webbrowser.open("http://" + app_ip + ":" + app_port)
    web.run_app(app, host=app_ip, port=int(app_port))

if __name__ == "__main__":
    server("", "", "")