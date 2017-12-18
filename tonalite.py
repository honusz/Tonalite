import pickle
import re
import unicodedata
import webbrowser
import datetime

import socketio
from aiohttp import web
from multidict import MultiDict

from pyudmx import uDMXDevice
from sACN import DMXSource

sio = socketio.AsyncServer(async_mode='aiohttp')
app = web.Application()
sio.attach(app)

fixtures = []
submasters = []
channels = [0] * 48
cues = []
show = {
    "name": "",
    "description": "",
    "authior": "",
    "copyright": "",
    "last_updated": "",
    "fixtures": [],
    "cues": []
}
clickedCue = None
source = None
sourceusb = None


def slugify(value):
    value = str(value)
    value = unicodedata.normalize('NFKC', value)
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[-\s]+', '-', value)


def set_list(l, i, v):
    try:
        l[i] = v
    except IndexError:
        for _ in range(i - len(l) + 1):
            l.append(None)
        l[i] = v


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


async def store_show_handler(request):
    global cues
    global fixtures
    global submasters
    global show
    data = await request.post()

    mp3 = data['show']

    # .filename contains the name of the file in string format.
    filename = mp3.filename

    # .file contains the actual file data that needs to be stored somewhere.
    mp3_file = data['show'].file

    content = pickle.loads(mp3_file.read())
    fixtures = content[0]
    submasters = content[1]
    cues = content[2]
    show = content[3]

    return web.HTTPFound('/')


async def saveshow(request):
    return web.Response(body=pickle.dumps([fixtures, submasters, cues, show], pickle.HIGHEST_PROTOCOL), headers={'Content-Disposition': 'attachment; filename="' + slugify(show["name"]) + '.tonalite"'}, content_type='application/octet-stream')


@sio.on('connect', namespace='/tonalite')
async def connect(sid, environ):
    await sio.emit('update all', {'channels': channels, 'cues': cues, 'selected_cue': clickedCue, 'show': show}, namespace='/tonalite')


@sio.on('cue info', namespace='/tonalite')
async def cue_info(sid, message):
    global clickedCue
    clickedCue = int(message['cue_id'])
    await sio.emit('cue settings', {'cues': cues, 'selected_cue': clickedCue, 'name': cues[int(message['cue_id'])]["name"], 'description': cues[int(message['cue_id'])]["description"], "time": cues[int(message['cue_id'])]["time"], "follow": cues[int(message['cue_id'])]["follow"]}, namespace='/tonalite')


@sio.on('update cue', namespace='/tonalite')
async def update_cue(sid, message):
    cues[clickedCue]["name"] = message['name']
    cues[clickedCue]["description"] = message['description']
    cues[clickedCue]["time"] = int(message['time'])
    cues[clickedCue]["follow"] = int(message['follow'])
    cues[clickedCue]["values"] = channels[:]
    await sio.emit('success', {'message': "Cue updated!", 'channels': channels, 'cues': cues, 'selected_cue': clickedCue, 'show': show}, namespace='/tonalite')


@sio.on('save show', namespace='/tonalite')
async def save_show(sid, message):
    global show
    show["name"] = message['name']
    show["description"] = message['description']
    show["author"] = message['author']
    show["copyright"] = message['copyright']
    show["last_updated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await sio.emit('redirect', {'url': "/show"}, namespace='/tonalite')


@sio.on('cue move', namespace='/tonalite')
async def cue_move(sid, message):
    global clickedCue
    if message['action'] == "up":
        if not clickedCue == 0:
            cues.insert(clickedCue - 1, cues.pop(clickedCue))
            clickedCue -= 1
    elif message['action'] == "down":
        if not clickedCue == len(cues):
            cues.insert(clickedCue + 1, cues.pop(clickedCue))
            clickedCue += 1
    elif message['action'] == "delete":
        cues.pop(clickedCue)
        clickedCue = None
    await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue}, namespace='/tonalite')


@sio.on('save cue', namespace='/tonalite')
async def save_cue(sid, message):
    cues[clickedCue]["name"] = message['name']
    cues[clickedCue]["description"] = message['description']
    cues[clickedCue]["time"] = int(message['time'])
    cues[clickedCue]["follow"] = int(message['follow'])
    await sio.emit('success', {'message': "Cue saved!", 'channels': channels, 'cues': cues, 'selected_cue': clickedCue, 'show': show}, namespace='/tonalite')


@sio.on('command message', namespace='/tonalite')
async def command_message(sid, message):
    global channels
    global cues
    cmd = message['command'].lower().split()
    if len(cmd) == 2:
        if cmd[0] == "r" and cmd[1] == "q":
            cues.append({
                "name": "Cue " + str(len(cues) + 1),
                "description": "This is a new cue",
                "time": 3,
                "follow": 0,
                "values": channels[:]
            })
            await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue}, namespace='/tonalite')
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
app.router.add_post('/show', store_show_handler)


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
    server("", "", "")
