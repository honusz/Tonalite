import asyncio
import os
import pickle
import time

import socketio

from aiohttp import web
from sACN import DMXSource

sacn_ip = "169.254.39.191"

source = DMXSource(universe=1, net_ip=sacn_ip)

channels = [0] * 48
cues = []
ccue = 0

running = False


def set_list(l, i, v):
    try:
        l[i] = v
    except IndexError:
        for _ in range(i - len(l) + 1):
            l.append(None)
        l[i] = v


def generate_fade(start, end, secs=3.0, fps=40):
    global running
    for index in range(int(secs * fps)):
        if running == True:
            for channel in range(len(start[0])):
                a = start[0][channel] or 0
                b = end[0][channel] or 0
                channels[channel] = int(a + (((b - a) / (secs * fps)) * index))
            source.send_data(channels)
            time.sleep(secs / (int(secs * fps)))
        else:
            running = False
            break
    running = False


sio = socketio.AsyncServer(async_mode='aiohttp')
app = web.Application()
sio.attach(app)


async def index(request):
    with open('index.html') as f:
        return web.Response(text=f.read(), content_type='text/html')


async def mobile(request):
    with open('mobile.html') as f:
        return web.Response(text=f.read(), content_type='text/html')


@sio.on('connect', namespace='/tonalite')
async def connect(sid, environ):
    await sio.emit('my response', {'data': channels}, namespace='/tonalite')


@sio.on('update chan', namespace='/tonalite')
async def updatechan_message(sid, message):
    chan = int(message['chan'].replace("cval-", "")) - 1
    value = int(message['val'])

    channels[chan] = value

    source.send_data(channels)

    await sio.emit('my response', {'data': channels}, namespace='/tonalite')

@sio.on('update chans', namespace='/tonalite')
async def updatechan_message(sid, message):
    chans = message['chans']

    for i in range(len(chans)):
        chans[i] = int(chans[i])

    channels = chans

    source.send_data(channels)

    await sio.emit('my response', {'data': channels}, namespace='/tonalite')

@sio.on('command message', namespace='/tonalite')
async def test_message(sid, message):
    global running
    global cues
    global channels
    global ccue
    cmd = message['data'].lower().split()
    if running != False:
        if len(cmd) == 2:
            if cmd[0] == "q":
                if cmd[1] == "s":
                    running = False
    else:
        if len(cmd) == 2:
            if cmd[0] == "q":
                if cmd[1] == "n":
                    running = True
                    generate_fade(cues[ccue], cues[ccue + 1],
                                  secs=cues[ccue + 1][1])
                    ccue = ccue + 1
                elif cmd[1] == "l":
                    running = True
                    generate_fade(cues[ccue], cues[ccue - 1],
                                  secs=cues[ccue - 1][1])
                    ccue = ccue - 1
        elif len(cmd) == 3:
            if cmd[0] == "q":
                if cmd[2] == "r":
                    set_list(cues, int(cmd[1]) - 1, [channels[:], 3.0])
                elif cmd[2] == "g":
                    running = True
                    generate_fade(cues[ccue], cues[int(
                        cmd[1]) - 1], secs=cues[int(cmd[1]) - 1][1])
                    ccue = int(cmd[1]) - 1
            elif cmd[0] == "sh":
                showspath = os.path.join(
                    os.path.expanduser('~'), "tonalite-shows")
                if not os.path.exists(showspath):
                    os.makedirs(showspath)
                if cmd[1] == "sv":
                    with open(os.path.join(showspath, cmd[2] + '.show'), 'wb') as f:
                        pickle.dump(cues, f, pickle.HIGHEST_PROTOCOL)
                elif cmd[1] == "op":
                    with open(os.path.join(showspath, cmd[2] + '.show'), 'rb') as f:
                        cues = pickle.load(f)
        elif len(cmd) == 4:
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
                            value = int(cmd[3])
                            if value > 255:
                                value = 255
                            elif value < 0:
                                value = 0
                        elif value == "d":
                            value = channels[int(chn) - 1] - 10
                            if value < 0:
                                value = 0
                        elif value == "b":
                            value = channels[int(chn) - 1] + 10
                            if value > 255:
                                value = 255
                        else:
                            value = 0
                        set_list(channels, int(chn) - 1, value)
                    source.send_data(channels)
            elif cmd[0] == "q":
                if cmd[2] == "t":
                    cues[int(cmd[1]) - 1][1] = float(cmd[3])

    await sio.emit('my response', {'data': channels}, namespace='/tonalite')

app.router.add_static('/static', 'static')
app.router.add_get('/', index)
app.router.add_get('/mobile', mobile)


if __name__ == '__main__':
    host = input("Which host? ")
    web.run_app(app, host=host, port=9898)
