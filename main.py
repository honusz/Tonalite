from flask import Flask, render_template, request, session
from flask_socketio import SocketIO, disconnect, emit

import re

from sACN import DMXSource

server_host = '192.168.0.103'
server_port = 6578
files_location = "./"
sacn_ip = "169.254.39.191"

source = DMXSource(universe=1, net_ip=sacn_ip)

async_mode = None

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode=async_mode)
thread = None

channels = [0] * 512

@app.route('/')
def index():
    return render_template('channels.html', async_mode=socketio.async_mode, channels=channels)

@socketio.on('command-line', namespace='/test')
def command_line(message):
    cmd = re.sub(' +',' ',message['command'])
    cmd = cmd.split(" ")

    if cmd[0] == "chan":
        if isinstance( int(cmd[1]), ( int, long ) ):
            if cmd[2] == "at":
                if isinstance( int(cmd[3]), ( int, long ) ):
                    if int(cmd[3]) >= 0:
                        if int(cmd[3]) > 255:
                            cmd[3] = 255
                        channels[int(cmd[1])-1] = int(cmd[3])
                        source.send_data(channels)
                        emit('update_chan', {'chan': int(cmd[1]), 'val': int(cmd[3])}, broadcast=True)


if __name__ == '__main__':
    socketio.run(app, host=server_host, port=server_port)
