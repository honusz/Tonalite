from flask import Flask

from sACN import DMXSource

server_host = '192.168.0.106'
server_port = 5000
files_location = "./"
sacn_ip = "169.254.39.191"

source = DMXSource(universe=1, net_ip=sacn_ip)

app = Flask(__name__)


@app.route('/')
def home():
    return 'Hello, World!'


if __name__ == '__main__':
    app.run(host=server_host, port=server_port)
