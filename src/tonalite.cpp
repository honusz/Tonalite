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
#include "json.hpp"
#include "utitities.hpp"
#include "uWebSockets/src/uWS.h"

using namespace std;
using namespace uWS;

struct channel
{
  int id;
  string type;
  int max;
  int min;
  int displayMax;
  int displayMin;
  int defaultVal;
  int dmxAddress;
  int value;
};

struct fixture
{
  int id;
  string name;
  string shortName;
  string manufacturer;
  int startDMXAddress;
  vector<channel> channels;
};

struct cue
{
  int id;
  string name;
  string description;
  bool active;
  int time;
  vector<fixture> fixtures;
};

int runDMX()
{
  vector<fixture> fixtures;
  vector<cue> cues;

  /* Start E1.31 testing */
  int sockfd;
  e131_packet_t packet;
  e131_addr_t dest;

  // create a socket for E1.31
  if ((sockfd = e131_socket()) < 0)
    err(EXIT_FAILURE, "e131_socket");

  // initialize the new E1.31 packet in universe 1 with 24 slots in preview mode
  e131_pkt_init(&packet, 1, 24);
  memcpy(&packet.frame.source_name, "Tonalite Client", 18);
  if (e131_set_option(&packet, E131_OPT_PREVIEW, true) < 0)
    err(EXIT_FAILURE, "e131_set_option");

  // set remote system destination as multicast address
  if (e131_multicast_dest(&dest, 1, E131_DEFAULT_PORT) < 0)
    err(EXIT_FAILURE, "e131_multicast_dest");

  // loop to send cycling levels for each slot
  uint8_t level = 0;
  for (;;)
  {
    for (size_t pos = 0; pos < 24; pos++)
      packet.dmp.prop_val[pos + 1] = level;
    level++;
    if (e131_send(sockfd, &packet, &dest) < 0)
      err(EXIT_FAILURE, "e131_send");
    cout << "Frame" << endl;
    //e131_pkt_dump(stderr, &packet);
    packet.frame.seq_number++;
    usleep(250000);
  }
};

void *PrintHello(void *threadid)
{
  long tid;
  tid = (long)threadid;
  cout << "Hello World! Thread ID, " << tid << endl;
  pthread_exit(NULL);
}

void *PrintHello2(void *threadid)
{
  long tid;
  tid = (long)threadid;
  for (;;)
  {
    cout << "Hello World 2! Thread ID, " << tid << endl;
  }
  pthread_exit(NULL);
}

int runTest()
{
  cout << "hi" << endl;
};

const char *find_embedded_file(const char *file_name, size_t *size);

int main()
{
  runTest();

  //runDMX();
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
  /*pthread_t threads[2];
  int rc;
  int rc2;
  rc = pthread_create(&threads[0], NULL, PrintHello, (void *)0);
      
      if (rc) {
         cout << "Error:unable to create thread," << rc << endl;
         exit(-1);
      }
   rc2 = pthread_create(&threads[1], NULL, PrintHello2, (void *)1);
      
      if (rc2) {
         cout << "Error:unable to create thread," << rc2 << endl;
         exit(-1);
      }
   pthread_exit(NULL);*/
}
