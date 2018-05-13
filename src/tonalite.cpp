#include <stdio.h>
#include <stdlib.h>
#include <stddef.h>
#include <unistd.h>
#include <string>
#include <iostream>
#include <cstdlib>
#include <pthread.h>
#include <err.h>
#include "e131.hpp"
#include "uWebSockets/src/uWS.h"
#include "json.hpp"
#include "structs.hpp"
#include "utitities.hpp"

using namespace std;
using namespace uWS;

vector<fixture> fixtures;
vector<cue> cues;
int sockfd;
e131_packet_t packet;
e131_addr_t dest;

vector<fixture> resetFixtureValues()
{
  for (fixture f : fixtures)
  {
    for (channel c : f.channels)
    {
      c.value = c.defaultValue;
    }
  }
  return fixtures;
};

int resetDMXValues()
{
  for (size_t pos = 0; pos < 512; pos++)
    packet.dmp.prop_val[pos + 1] = 0;
  return 0;
}

void *serverLoop(void *threadid)
{
  long tid;
  tid = (long)threadid;

  Hub h;
  string response = "<!DOCTYPE html><html><head><title>hi</title></head><body><h1>hello world!</h1></body></html>";

  h.onMessage([](WebSocket<SERVER> *ws, char *message, size_t length, OpCode opCode) {
    ws->send(message, length, opCode);
  });

  h.onHttpRequest([&](HttpResponse *res, HttpRequest req, char *data, size_t length,
                      size_t remainingBytes) {
    res->end(response.data(), response.length());
  });

  if (h.listen(3000))
  {
    h.run();
  }

  pthread_exit(NULL);
}

void *startDMX(void *threadid)
{
  long tid;
  tid = (long)threadid;

  // create a socket for E1.31
  if ((sockfd = e131_socket()) < 0)
    err(EXIT_FAILURE, "e131_socket");

  // initialize the new E1.31 packet in universe 1 with 24 slots in preview mode
  e131_pkt_init(&packet, 1, 512);
  memcpy(&packet.frame.source_name, "Tonalite Client", 16);
  if (e131_set_option(&packet, E131_OPT_PREVIEW, true) < 0)
    err(EXIT_FAILURE, "e131_set_option");

  // set remote system destination as multicast address
  if (e131_multicast_dest(&dest, 1, E131_DEFAULT_PORT) < 0)
    err(EXIT_FAILURE, "e131_multicast_dest");

  for (;;)
  {
    resetDMXValues();
    if (e131_send(sockfd, &packet, &dest) < 0)
      err(EXIT_FAILURE, "e131_send");
    cout << "Frame" << endl;
    //e131_pkt_dump(stderr, &packet);
    packet.frame.seq_number++;
    usleep(250000);
  }

  pthread_exit(NULL);
}

int main()
{
  pthread_t threads[2];
  int rc;
  int rc2;
  rc = pthread_create(&threads[0], NULL, serverLoop, (void *)0);
  if (rc)
  {
    cout << "Error:unable to create thread," << rc << endl;
    exit(-1);
  }
  rc2 = pthread_create(&threads[1], NULL, startDMX, (void *)1);
  if (rc2)
  {
    cout << "Error:unable to create thread," << rc2 << endl;
    exit(-1);
  }
  pthread_exit(NULL);
}
