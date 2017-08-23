import asyncio
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


def generate_fade(threadname, start, end, secs=3.0, fps=40):
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
    with open('client.html') as f:
        return web.Response(text=f.read(), content_type='text/html')


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
                    generate_fade(cues[ccue], cues[ccue + 1], secs=cues[ccue + 1][1])
                    ccue = ccue + 1
                elif cmd[1] == "l":
                    running = True
                    generate_fade(cues[ccue], cues[ccue - 1], secs=cues[ccue - 1][1])
                    ccue = ccue - 1
        elif len(cmd) == 3:
            if cmd[0] == "q":
                if cmd[2] == "r":
                    set_list(cues, int(cmd[1]) - 1, [channels[:], 3.0])
                elif cmd[2] == "g":
                    running = True
                    generate_fade(cues[ccue], cues[int(cmd[1]) - 1], secs=cues[int(cmd[1]) - 1][1])
                    ccue = int(cmd[1]) - 1
        elif len(cmd) == 4:
            if cmd[0] == "c":
                if cmd[2] == "a":
                    value = cmd[3]
                    if value != "d" and value != "b":
                        value = int(cmd[3])
                        if value > 255:
                            value = 255
                        elif value < 0:
                            value = 0
                    elif value == "d":
                        value = channels[int(cmd[1]) - 1] - 10
                        if value < 0:
                            value = 0
                    elif value == "b":
                        value = channels[int(cmd[1]) - 1] + 10
                        if value > 255:
                            value = 255
                    else:
                        value = 0
                    set_list(channels, int(cmd[1]) - 1, value)
                    source.send_data(channels)
            elif cmd[0] == "q":
                if cmd[2] == "t":
                    cues[int(cmd[1]) - 1][1] = float(cmd[3])

    await sio.emit('my response', {'data': 'Command recieved and processed!'}, room=sid,
                   namespace='/tonalite')

app.router.add_static('/static', 'static')
app.router.add_get('/', index)


if __name__ == '__main__':
    web.run_app(app, host='192.168.0.102', port=9898)
