from flask import Flask, render_template, request, session
from flask_socketio import SocketIO, disconnect, emit

from sACN import DMXSource

server_host = '192.168.0.108'
server_port = 6578
files_location = "./"
sacn_ip = "169.254.39.191"

source = DMXSource(universe=1, net_ip=sacn_ip)

async_mode = None

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode=async_mode)
thread = None

@app.route('/')
def index():
    return render_template('channels.html', async_mode=socketio.async_mode)

@socketio.on('command-line', namespace='/test')
def command_line(message):
    print(message['command'])

if __name__ == '__main__':
    socketio.run(app, host=server_host, port=server_port)
