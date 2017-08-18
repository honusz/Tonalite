from sACN import DMXSource

sacn_ip = "169.254.39.191"

source = DMXSource(universe=1, net_ip=sacn_ip)

channels = [0] * 512
cues = []

# source.send_data(channels)
