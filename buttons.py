import time
import socketio
from gpiozero import Button
from signal import pause

sio = socketio.Client()

nextBtn = Button(17)
stopBtn = Button(27)
lastBtn = Button(22)

def sendNext():
	print("next")
	sio.emit('nextCue')

def sendLast():
	sio.emit('lastCue')

def sendStop():
	sio.emit('stopCue');

@sio.on('connect')
def on_connect():
	print("connected")


def start_server():
	sio.connect('http://192.168.0.107:3000')
	sio.wait()

if __name__ == '__main__':
	lastBtn.when_pressed = sendNext
	stopBtn.when_pressed = sendStop
	lastBtn.when_pressed = sendLast
	start_server()
