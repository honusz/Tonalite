import socketio
import webbrowser

import pickle

from aiohttp import web
from sACN import DMXSource
from pyudmx import uDMXDevice

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
source = None
sourceusb = None


def sendDMX(chans):
    global source
    global sourceusb
    source.send_data(chans)
    # sourceusb.open()
    # sourceusb.send_multi_value(1, chans)
    # sourceusb.close()


async def index(request):
    with open('app.html') as f:
        return web.Response(text=f.read(), content_type='text/html')


async def saveshow(request):
    return web.Response(body=pickle.dumps([fixtures, submasters, cues, show], pickle.HIGHEST_PROTOCOL), headers={'Content-Disposition': 'attachment; filename="f.tonalite"'}, content_type='application/octet-stream')


@sio.on('connect', namespace='/tonalite')
async def connect(sid, environ):
    await sio.emit('update all', {'channels': channels, 'cues': cues}, namespace='/tonalite')


@sio.on('cue info', namespace='/tonalite')
async def cue_info(sid, message):
    print(message['cue_id'])

@sio.on('command message', namespace='/tonalite')
async def command_message(sid, message):
    global channels
    global cues
    cmd = message['command'].lower().split()
    if len(cmd) == 1:
        if cmd[0] == "rnc":
            cues.append({
                "name": "New Cue",
                "description": "this is a new cue",
                "time": 3,
                "follow": 0,
                "values": channels[:]
            })
            await sio.emit('update cues', {'cues': cues}, namespace='/tonalite')
    if len(cmd) == 4:
        if cmd[0] == "c":
            if "+" in cmd[1]:
                schans = cmd[1].split("+")
            elif "-" in cmd[1]:
                schans = cmd[1].split("-")
                if len(schans) == 2:
                    crange = int(schans[1]) - int(schans[0])
                    cchans = []
                    for i in range(crange + 1):
                        cchans = cchans + [int(schans[0]) + i]
                    schans = cchans
            else:
                schans = [cmd[1]]
            if cmd[2] == "a":
                value = cmd[3]
                for chn in schans:
                    if value != "d" and value != "b":
                        value = max(0, min(int(value), 255))
                    elif value == "d":
                        value = max(
                            0, min(channels[int(chn) - 1] - 10, 255))
                    elif value == "b":
                        value = max(
                            0, min(channels[int(chn) - 1] + 10, 255))
                    else:
                        value = 0
                    channels[int(chn) - 1] = value
                sendDMX(channels)
                await sio.emit('update chans', {'channels': channels}, namespace='/tonalite')

app.router.add_static('/static', 'static')
app.router.add_get('/', index)
app.router.add_get('/show', saveshow)


def server(app_ip, app_port, sacn_ip):
    global source
    global sourceusb
    if app_ip == "":
        app_ip = "127.0.0.1"
    if app_port == "":
        app_port = "9898"
    if sacn_ip == "":
        sacn_ip = "127.0.0.1"

    source = DMXSource(universe=1, net_ip=sacn_ip)
    sourceusb = uDMXDevice()
    webbrowser.open("http://" + app_ip + ":" + app_port)
    web.run_app(app, host=app_ip, port=int(app_port))


if __name__ == "__main__":
    server("192.168.0.104", "", "")
