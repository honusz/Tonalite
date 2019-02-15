import time
from signal import pause

import socketio
from gpiozero import Button

sio = socketio.Client()

nextBtn = Button(17)
stopRecordBtn = Button(27)
lastBtn = Button(22)
nextFixtureBtn = Button(23)
lastFixtureBtn = Button(24)

fixtures = []
currentFixture = 0
currentFixtureChans = {}


def sendNextCue():
    print("next")
    sio.emit('nextCue')


def sendLastCue():
    sio.emit('lastCue')


def sendStopCue():
    sio.emit('stopCue')


def sendRecordCue():
    sio.emit('recordCue')


def sendGetNextFixtureChans():
	if currentFixture + 1 == len(fixtures):
		currentFixture = 0
	else:
		currentFixture = currentFixture + 1
    sio.emit('getFixtureChannels', fixtures[currentFixture]['id'])

def sendGetLastFixtureChans():
	if currentFixture == 0:
		currentFixture = len(fixtures) - 1
	else:
		currentFixture = currentFixture - 1
    sio.emit('getFixtureChannels', fixtures[currentFixture]['id'])

lastBtn.when_pressed = sendNextCue
stopRecordBtn.when_pressed = sendStopCue
lastBtn.when_pressed = sendLastCue
nextFixtureBtn.when_pressed = sendGetNextFixtureChans
lastFixtureBtn.when_pressed = sendGetLastFixtureChans

@sio.on('connect')
def on_connect():
    print("connected to server")


@sio.on('fixtures')
def getFixtures(data):
    fixtures = data

@sio.on('fixtureChannels')
def getCurrentFixture(data):
    currentFixtureChans = {'id': data['id'], 'name': data['name'], 'channels': data['channels'], 'chips': data['chips']}

@sio.on('cueActionBtn')
def cueActionBtn(data):
    if data == True:
        stopRecordBtn.when_pressed == sendStopCue
    else:
        stopRecordBtn.when_pressed == sendRecordCue


def start_server():
    sio.connect('http://10.166.66.1:3000')
    sio.wait()


if __name__ == '__main__':
    start_server()
