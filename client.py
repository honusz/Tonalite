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


def set_list(l, i, v):
    try:
        l[i] = v
    except IndexError:
        for _ in range(i - len(l) + 1):
            l.append(None)
        l[i] = v


def generate_fade(start, end, secs=3.0, fps=40):
    for index in range(int(secs * fps)):
        for channel in range(len(start)):
            a = start[channel] or 0
            b = end[channel] or 0
            channels[channel] = int(a + (((b - a) / (secs * fps)) * index))
        source.send_data(channels)
        time.sleep(secs / (int(secs * fps)))


sio = socketio.AsyncServer(async_mode='aiohttp')
app = web.Application()
sio.attach(app)


async def index(request):
    with open('client.html') as f:
        return web.Response(text=f.read(), content_type='text/html')


@sio.on('command message', namespace='/tonalite')
async def test_message(sid, message):
    global cues
    global channels
    global ccue
    cmd = message['data'].lower().split()
    if len(cmd) == 3:
        if cmd[0] == "q":
            if cmd[2] == "r":
                set_list(cues, int(cmd[1]) - 1, channels[:])
            elif cmd[2] == "g":
                generate_fade(cues[ccue], cues[int(cmd[1]) - 1])
                ccue = int(cmd[1]) - 1
    elif len(cmd) == 4:
        if cmd[0] == "c":
            if cmd[2] == "a":
                set_list(channels, int(cmd[1]) - 1, int(cmd[3]))
                source.send_data(channels)

    await sio.emit('my response', {'data': 'Command recieved and processed!'}, room=sid,
                   namespace='/tonalite')

app.router.add_static('/static', 'static')
app.router.add_get('/', index)


if __name__ == '__main__':
    web.run_app(app, host='192.168.0.102', port=9898)
