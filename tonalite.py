import datetime
import math
import os
import pickle
import re
import sys
import time
import unicodedata
import webbrowser

import socketio
from aiohttp import web
from passlib.hash import pbkdf2_sha256

from channelman import calculate_chans
from sACN import DMXSource

sio = socketio.AsyncServer(async_mode='aiohttp')
app = web.Application()
sio.attach(app)

grandmaster = 100
channels = [0] * 48
outputChannels = [None] * 48
submasters = []
cues = []
show = {
    "name": "",
    "description": "",
    "authior": "",
    "copyright": "",
    "last_updated": "",
    "cues": []
}
clickedCue = None
clickedSub = None
currentCue = None
source = None
tonaliteSettings = {
    "serverIP": "127.0.0.1",
    "serverPort": "9898",
    "sacnIP": "127.0.0.1",
    "users": [
        ("admin", "$pbkdf2-sha256$29000$OMe4VwrBmHMO4TxH6L1Xag$YDlHIuACixZPkNm8GjP24Jfk88o/fVufek/1NF/sOrg")
    ]
}


def resource_path(relative_path):
    """Get the correct path to the resources when using either PyInstaller or the cli"""
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)


def slugify(value):
    """Generate a url or filename worthy string from input text"""
    value = unicodedata.normalize('NFKC', value)
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[-\s]+', '-', value)


async def generate_fade(start, end, secs=3.0, fps=40):
    """Calculate the fade between two cues"""
    global channels
    for i in range(int(secs * fps) + 1):
        for channel, _ in enumerate(start):
            s_chan = start[channel] or 0
            e_chan = end[channel] or 0
            channels[channel] = int(s_chan + (((e_chan - s_chan) / (secs * fps)) * i))

        source.send_data(calculate_chans(channels, outputChannels, submasters, grandmaster))
        await sio.emit('update chans', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster)}, namespace='/tonalite')
        time.sleep(secs / int(secs * fps))


def set_sub_chans():
    """Create submaster channels based on what was set by the user"""
    temp_channels = []

    for i, _ in enumerate(outputChannels):
        if outputChannels[i] != None:
            temp_channels.append(
                {"channel": i + 1, "value": math.ceil((outputChannels[i] / 255) * 100)})

    return temp_channels


async def index(request):
    """Load the app file"""
    with open(resource_path('index.min.html')) as w_f:
        return web.Response(text=w_f.read(), content_type='text/html')

async def app_index_get(request):
    return web.HTTPFound('/')

async def app_index(request):
    """Load the app file"""
    data = await request.post()
    iuser = data['user']
    ipass = data['password']

    for use, _ in enumerate(tonaliteSettings["users"]):
        if tonaliteSettings["users"][use][0] == iuser:
            if pbkdf2_sha256.verify(ipass, tonaliteSettings["users"][use][1]):
                with open(resource_path('app.min.html')) as w_f:
                    return web.Response(text=w_f.read(), content_type='text/html')

    return web.HTTPFound('/')


async def store_show_handler(request):
    """Load the show as a file and read the config"""
    global cues
    global show
    global submasters
    data = await request.post()

    show_f = data['show']

    # filename contains the name of the file in string format.
    filename = show_f.filename

    if ".tonalite" in filename:
        # show_file contains the actual file data that needs to be stored somewhere.
        show_file = data['show'].file

        content = pickle.loads(show_file.read())
        cues = content[0]
        show = content[1]
        submasters = content[2]

    return web.HTTPFound('/')


async def saveshow(request):
    """Return the show as a file object"""
    return web.Response(body=pickle.dumps([cues, show, submasters], pickle.HIGHEST_PROTOCOL), headers={'Content-Disposition': 'attachment; filename="' + slugify(show["name"]) + '.tonalite"'}, content_type='application/octet-stream')


@sio.on('connect', namespace='/tonalite')
async def connect(sid, environ):
    """On client connection - give all current show values"""
    await sio.emit('update all', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster), 'cues': cues, 'selected_cue': clickedCue, 'show': show, 'current_cue': currentCue, 'tonaliteSettings': tonaliteSettings, 'submasters': submasters, 'grandmaster': grandmaster}, namespace='/tonalite')


@sio.on('cue info', namespace='/tonalite')
async def cue_info(sid, message):
    """Give the info for the clicked cue"""
    global clickedCue
    clickedCue = int(message['cue_id'])
    await sio.emit('cue settings', {'cues': cues, 'selected_cue': clickedCue, 'name': cues[int(message['cue_id'])]["name"], 'description': cues[int(message['cue_id'])]["description"], "time": cues[int(message['cue_id'])]["time"], "follow": cues[int(message['cue_id'])]["follow"], 'current_cue': currentCue}, namespace='/tonalite', room=sid)


@sio.on('sub info', namespace='/tonalite')
async def sub_info(sid, message):
    """Give the info for the clicked submaster"""
    global clickedSub
    clickedSub = int(message['sub'].split("sub-btn-", 1)[1])
    await sio.emit('sub settings', {'name': submasters[clickedSub]["name"], 'channels': submasters[clickedSub]["channels"], 'value': submasters[clickedSub]["value"]}, namespace='/tonalite', room=sid)


@sio.on('add sub', namespace='/tonalite')
async def add_sub(sid, message):
    """Create a new submaster with default values"""
    submasters.append(
        {"name": "New Sub", "channels": set_sub_chans(), "value": 0})
    await sio.emit('update subs', {'submasters': submasters}, namespace='/tonalite')


@sio.on('remove sub', namespace='/tonalite')
async def remove_sub(sid, message):
    """Remove the submaster from the show"""
    submasters.pop(clickedSub)
    await sio.emit('update subs', {'submasters': submasters}, namespace='/tonalite')


@sio.on('add sub chan', namespace='/tonalite')
async def add_sub_chan(sid, message):
    """Add a control channel to the current submaster"""
    submasters[clickedSub]["channels"].append({"channel": 1, "value": 100})
    await sio.emit('sub settings', {'name': submasters[clickedSub]["name"], 'channels': submasters[clickedSub]["channels"], 'value': submasters[clickedSub]["value"]}, namespace='/tonalite', room=sid)


@sio.on('edit users', namespace='/tonalite')
async def edit_users(sid, message):
    """Edit the users"""
    if message["action"] == "delete":
        tonaliteSettings["users"].pop(message["user"])
    elif message["action"] == "new":
        tonaliteSettings["users"].append(
            (message["user"], pbkdf2_sha256.hash(message["password"])))
    await sio.emit('update all', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster), 'cues': cues, 'selected_cue': clickedCue, 'show': show, 'current_cue': currentCue, 'tonaliteSettings': tonaliteSettings, 'submasters': submasters, 'grandmaster': grandmaster}, namespace='/tonalite')


@sio.on('edit sub chan', namespace='/tonalite')
async def edit_sub_chan(sid, message):
    """Edit the current control channel on the current submaster"""
    if message["action"] == "save":
        submasters[clickedSub]["channels"][message["chan"]
                                           ]["channel"] = int(message["channel"])
        submasters[clickedSub]["channels"][message["chan"]
                                           ]["value"] = int(message["value"])
    elif message["action"] == "delete":
        submasters[clickedSub]["channels"].pop(message["chan"])
    source.send_data(calculate_chans(channels, outputChannels, submasters, grandmaster))
    await sio.emit('sub settings', {'name': submasters[clickedSub]["name"], 'channels': submasters[clickedSub]["channels"], 'value': submasters[clickedSub]["value"]}, namespace='/tonalite', room=sid)


@sio.on('update cue', namespace='/tonalite')
async def update_cue(sid, message):
    """Update the channel values for the current cue"""
    cues[clickedCue]["values"] = calculate_chans([0] * 48, outputChannels, submasters, grandmaster)
    await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')


@sio.on('update sub val', namespace='/tonalite')
async def update_sub_val(sid, message):
    """Handler for when a submaster is set - update the show channel values"""
    global submasters
    submasters[int(message["sub"].split("sub-", 1)[1])]["value"] = int(message["value"])
    source.send_data(calculate_chans(channels, outputChannels, submasters, grandmaster))
    await sio.emit('update chans and subs', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster), 'submasters': submasters}, namespace='/tonalite')

@sio.on('update grand val', namespace='/tonalite')
async def update_grand_val(sid, message):
    """Handler for when the grandmaster is set - update the show channel values"""
    global grandmaster
    grandmaster = int(message["value"])
    source.send_data(calculate_chans(channels, outputChannels, submasters, grandmaster))
    await sio.emit('set grand val', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster), 'grandmaster': grandmaster}, namespace='/tonalite', skip_sid=sid)
    await sio.emit('update chans', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster)}, namespace='/tonalite', room=sid)

@sio.on('save show', namespace='/tonalite')
async def save_show(sid, message):
    """Save the current show settings and redirect to the show download"""
    global show
    show["name"] = message['name']
    show["description"] = message['description']
    show["author"] = message['author']
    show["copyright"] = message['copyright']
    show["last_updated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await sio.emit('redirect', {'url': "/show"}, namespace='/tonalite', room=sid)


@sio.on('clear show', namespace='/tonalite')
async def clear_show(sid, message):
    """Reset all show settings to default"""
    global channels
    global outputChannels
    global submasters
    global cues
    global show
    global clickedCue
    global currentCue
    channels = [0] * 48
    outputChannels = [None] * 48
    submasters = []
    cues = []
    show = {
        "name": "",
        "description": "",
        "authior": "",
        "copyright": "",
        "last_updated": "",
        "cues": []
    }
    clickedCue = None
    currentCue = None
    await sio.emit('update all', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster), 'cues': cues, 'selected_cue': clickedCue, 'show': show, 'current_cue': currentCue, 'tonaliteSettings': tonaliteSettings, 'submasters': submasters, 'grandmaster': grandmaster}, namespace='/tonalite')


@sio.on('cue move', namespace='/tonalite')
async def cue_move(sid, message):
    """Move the current cue up or down in the list, release the current cue, or fade between cues"""
    global clickedCue
    global currentCue
    global channels
    if message['action'] == "up":
        if clickedCue != 0:
            cues.insert(clickedCue - 1, cues.pop(clickedCue))
            clickedCue -= 1
        await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
    elif message['action'] == "down":
        if not clickedCue == len(cues):
            cues.insert(clickedCue + 1, cues.pop(clickedCue))
            clickedCue += 1
        await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
    elif message['action'] == "delete":
        cues.pop(clickedCue)
        clickedCue = None
        await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
    elif message['action'] == "duplicate":
        cues.insert(len(cues), cues[clickedCue])
        clickedCue = None
        await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
    elif message['action'] == "next":
        if currentCue != None:
            if currentCue != len(cues) - 1:
                currentCue += 1
                await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
                await generate_fade(cues[currentCue - 1]["values"], cues[currentCue]["values"], cues[currentCue]["time"])
                while cues[currentCue]["follow"] != 0:
                    if currentCue != len(cues) - 1:
                        await sio.sleep(cues[currentCue]["follow"])
                        currentCue += 1
                        await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
                        await generate_fade(cues[currentCue - 1]["values"], cues[currentCue]["values"], cues[currentCue]["time"])
        else:
            currentCue = 0
            await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
            await generate_fade([0] * 48, cues[currentCue]["values"], cues[currentCue]["time"])
            while cues[currentCue]["follow"] != 0:
                if currentCue != len(cues) - 1:
                    await sio.sleep(cues[currentCue]["follow"])
                    currentCue += 1
                    await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
                    await generate_fade(cues[currentCue - 1]["values"], cues[currentCue]["values"], cues[currentCue]["time"])
        await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
    elif message['action'] == "last":
        if currentCue != None:
            if currentCue != 0:
                currentCue -= 1
                await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
                await generate_fade(cues[currentCue + 1]["values"], cues[currentCue]["values"], cues[currentCue]["time"])
            await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
    elif message['action'] == "release":
        currentCue = None
        channels = [0] * 48
        source.send_data(calculate_chans(channels, outputChannels, submasters, grandmaster))
        await sio.emit('update chans and cues', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster), 'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')


@sio.on('save cue', namespace='/tonalite')
async def save_cue(sid, message):
    """Save the current cue settings"""
    cues[clickedCue]["name"] = message['name']
    cues[clickedCue]["description"] = message['description']
    cues[clickedCue]["time"] = float(message['time'])
    cues[clickedCue]["follow"] = float(message['follow'])
    await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')


@sio.on('save sub', namespace='/tonalite')
async def save_sub(sid, message):
    submasters[clickedSub]["name"] = message["name"]
    submasters[clickedSub]["value"] = max(0, min(int(message["value"]), 100))
    source.send_data(calculate_chans(channels, outputChannels, submasters, grandmaster))
    await sio.emit('update chans and subs', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster), 'submasters': submasters}, namespace='/tonalite')


@sio.on('command message', namespace='/tonalite')
async def command_message(sid, message):
    global channels
    global outputChannels
    global cues
    global currentCue
    global clickedCue
    cmd = message['command'].lower().split()
    if len(cmd) == 2:
        if cmd[0] == "r" and cmd[1] == "q":
            cues.append({
                "name": "Cue " + str(len(cues) + 1),
                "description": "This is a new cue",
                "time": 3,
                "follow": 0,
                "values": calculate_chans([0] * 48, outputChannels, [], 100)
            })
            await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
        elif cmd[0] == "c" and cmd[1] == "rs":
            outputChannels = [None] * 48
            source.send_data(calculate_chans(
                channels, outputChannels, submasters, grandmaster))
            await sio.emit('update chans', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster)}, namespace='/tonalite')
        elif cmd[0] == "q" and cmd[1].isdigit():
            setCue = int(cmd[1])
            if setCue == 9949:
                setCue = clickedCue + 1
            if setCue <= len(cues) and setCue >= 1:
                setCue -= 1
                await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
                await generate_fade(channels, cues[setCue]["values"], cues[setCue]["time"])
                currentCue = setCue
                while cues[currentCue]["follow"] != 0:
                    if currentCue != len(cues) - 1:
                        await sio.sleep(cues[currentCue]["follow"])
                        currentCue += 1
                        await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
                        await generate_fade(cues[currentCue - 1]["values"], cues[currentCue]["values"], cues[currentCue]["time"])
                await sio.emit('update cues', {'cues': cues, 'selected_cue': clickedCue, 'current_cue': currentCue}, namespace='/tonalite')
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
                        value = int((255/100) * (max(0, min(int(value), 100))))
                    elif value == "d":
                        if outputChannels[int(chn) - 1] != None:
                            value = max(0, min(channels[int(chn) - 1] - 25, 255))
                        else:
                            value = 0
                    elif value == "b":
                        if outputChannels[int(chn) - 1] != None:
                            value = max(0, min(channels[int(chn) - 1] + 25, 255))
                        else:
                            value = 25
                    else:
                        value = 0
                    if len(outputChannels) >= int(chn):
                        outputChannels[int(chn) - 1] = value
                    value = cmd[3]
                source.send_data(calculate_chans(channels, outputChannels, submasters, grandmaster))
                await sio.emit('update chans', {'channels': calculate_chans(channels, outputChannels, submasters, grandmaster)}, namespace='/tonalite')


@sio.on('save settings', namespace='/tonalite')
async def save_settings(sid, message):
    global tonaliteSettings
    tonaliteSettings["sacnIP"] = message['sacnIP']
    tonaliteSettings["serverIP"] = message['serverIP']
    tonaliteSettings["serverPort"] = message['serverPort']

    tonaliteConfig = os.path.join(os.path.expanduser("~"), ".tonaliteConfig")
    pickle.dump(tonaliteSettings, open(
        tonaliteConfig, "wb"), pickle.HIGHEST_PROTOCOL)
    await sio.emit('update settings', {'tonaliteSettings': tonaliteSettings}, namespace='/tonalite')

app.router.add_static('/static', resource_path('static'))
app.router.add_get('/app', app_index_get)
app.router.add_post('/app', app_index)
app.router.add_get('/', index)
app.router.add_get('/show', saveshow)
app.router.add_post('/show', store_show_handler)


def server(app_ip, app_port, sacn_ip, runBrowser=True):
    global source

    source = DMXSource(universe=1, net_ip=sacn_ip)
    if runBrowser:
        webbrowser.open("http://" + app_ip + ":" + app_port)
    web.run_app(app, host=app_ip, port=int(app_port))


if __name__ == "__main__":
    tonaliteConfig = os.path.join(os.path.expanduser("~"), ".tonaliteConfig")

    if not os.path.exists(tonaliteConfig):
        pickle.dump(tonaliteSettings, open(
            tonaliteConfig, "wb"), pickle.HIGHEST_PROTOCOL)

    config = pickle.load(open(tonaliteConfig, "rb"))
    tonaliteSettings["serverIP"] = config["serverIP"]
    tonaliteSettings["serverPort"] = config["serverPort"]
    tonaliteSettings["sacnIP"] = config["sacnIP"]

    print("Tonalite Lighting Control v1.0.0")
    try:
        server(tonaliteSettings["serverIP"],
               tonaliteSettings["serverPort"], tonaliteSettings["sacnIP"])
    except:
        server("127.0.0.1", "9898", "127.0.0.1")
