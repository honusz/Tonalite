import time
import webbrowser
from multiprocessing import Process
from tkinter import *

from sACN import DMXSource


def server(app_ip, app_port, sacn_ip):
    if app_ip == "":
        app_ip = "192.168.0.102"
    if app_port == "":
        app_port = "9898"
    if sacn_ip == "":
        sacn_ip = "169.254.39.191"

    source = DMXSource(universe=1, net_ip=sacn_ip)
    webbrowser.open("http://" + app_ip + ":" + app_port)
    #web.run_app(app, host=app_ip, port=int(app_port))


class App:
    def __init__(self, master):
        self.p1 = None
        Label(master, text="Tonalite IP:").grid(row=0)
        Label(master, text="sACN IP:").grid(row=2)

        self.app_ip = Entry(master)
        self.app_ip.insert(0, "192.168.0.102")
        self.app_port = Entry(master)
        self.app_port.insert(0, "9898")
        self.sacn_ip = Entry(master)
        self.sacn_ip.insert(0, "169.254.39.191")

        self.app_ip.grid(row=0, column=1)
        self.app_port.grid(row=1, column=1)
        self.sacn_ip.grid(row=2, column=1)

        self.quitBtn = Button(master, text="Stop Server", fg="red",
                              command=self.stopserver, width=26, pady=5)

        self.startBtn = Button(master, text="Start Server", fg="green",
                               command=self.startserver, width=26, pady=5)
        self.startBtn.grid(row=3, columnspan=2)

    def startserver(self):
        self.startBtn.grid_forget()
        self.quitBtn.grid(row=3, columnspan=2)
        self.p1 = Process(target=server, args=(
            self.app_ip.get(), self.app_port.get(), self.sacn_ip.get()))
        self.p1.start()

    def stopserver(self):
        self.startBtn.grid(row=3, columnspan=2)
        self.quitBtn.grid_forget()
        self.p1.terminate()


if __name__ == "__main__":
    root = Tk()
    app = App(root)
    root.mainloop()
