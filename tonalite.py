from sACN import DMXSource
from tkinter import *


class App:
    def __init__(self, master):
        Label(master, text="Tonalite IP:").grid(row=0)
        Label(master, text="sACN IP:").grid(row=1)

        self.app_ip = Entry(master)
        self.sacn_ip = Entry(master)

        self.app_ip.grid(row=0, column=1)
        self.sacn_ip.grid(row=1, column=1)

        self.quitBtn = Button(master, text="Quit", fg="red",
                              command=master.quit).grid(row=2, column=0)

        self.startBtn = Button(master, text="Start",
                               command=self.start).grid(row=2, column=1)

    def start(self):
        print("hi there, everyone!")


root = Tk()

app = App(root)

root.mainloop()
