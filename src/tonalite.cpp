#include <stdio.h>
#include <stdlib.h>
#include <stddef.h>
#include <unistd.h>
#include <string>
#include <iostream>
#include <fstream>
#include <cstdlib>
#include <pthread.h>
#include <err.h>
#include "e131.hpp"
#include "uWebSockets/src/uWS.h"
#include "json.hpp"
#include "structs.hpp"
#include "utilities.hpp"

using namespace std;
using namespace uWS;
using json = nlohmann::json;

vector<fixture> fixtures;
vector<cue> cues;
int sockfd;
e131_packet_t packet;
e131_addr_t dest;

template<class UnaryFunction>
void recursive_iterate(const json& j, UnaryFunction f)
{
    for(auto it = j.begin(); it != j.end(); ++it)
    {
        if (it->is_structured())
        {
            recursive_iterate(*it, f);
        }
        else
        {
            f(it);
        }
    }
}

vector<fixture> resetChannelValues()
{
  // Reset all the channels in all fixtures to their defaults
  for (fixture f : fixtures)
  {
    for (channel c : f.channels)
    {
      c.active = false;
      c.value = c.defaultValue;
    }
  }
  return fixtures;
};

int resetDMXValues()
{
  // Reset the dmx values to 0 on each frame before effects/fixture values added
  for (size_t pos = 0; pos < 512; pos++)
    packet.dmp.prop_val[pos + 1] = 0;
  return 0;
};

int calculateFixtures(bool hasActive)
{
  // Set the dmx output values to the values for each channel
  // If hasActive is true, only update the dmx values for channels that are active ie. should overwrite other things
  for (fixture f : fixtures)
  {
    for (channel c : f.channels)
    {
      if (hasActive == true)
      {
        if (c.active == true)
        {
          packet.dmp.prop_val[f.startDMXAddress + c.dmxAddress] = mapRange(c.value, c.displayMin, c.displayMax, c.min, c.max);
        }
      }
      else
      {
        packet.dmp.prop_val[f.startDMXAddress + c.dmxAddress] = mapRange(c.value, c.displayMin, c.displayMax, c.min, c.max);
      }
    }
  }
  return 0;
};

int calculateEffects()
{
  // Calcuate the running effects
  return 0;
};

int processMessage(string message)
{
  json j = json::parse(message);

  if (j["msg"] == "addFixture")
  {
    // Import the fixture spec from file
    string fixtureName = j["fixture"].dump();
    fixtureName.erase(remove(fixtureName.begin(), fixtureName.end(), '\"' ), fixtureName.end());
    ifstream i("../fixtures/"+fixtureName+".json");
    json f;
    i >> f;

    // Create a new fixture from the fixture spec and save it to the fixtures list
    fixture newFixture;
    newFixture.id = randomString();
    newFixture.name = f["name"];
    newFixture.shortName = f["shortName"];
    newFixture.manufacturer = f["manufacturer"];
    newFixture.startDMXAddress = j["startDMXAddress"];
    channel newChannel;
    for (auto& x : json::iterator_wrapper(f["channels"]))
    {
        newChannel.id = randomString();
        //newChannel.type = x.value()["type"];
        cout << "key: " << x.key() << ", value: " << x.value() << '\n';
    }
    fixtures.push_back(newFixture);
  } else if (j["msg"] == "getFixtureProfiles") {
  	// Return the list of file in the fixtures folder
  } else if (j["msg"] == "removeFixture") {
	// Remove the selected fixture
  } else if (j["msg"] == "getFixtureSettings") {
	// Return the settings for the selected fixture
  } else {
  	cout << "That message type is not known!" << endl;
  }
  return 0;
};

void *serverLoop(void *threadid)
{
  long tid;
  tid = (long)threadid;

  Hub h;
  string response = "<!DOCTYPE html><html><head><title>hi</title></head><body><h1>hello world!</h1></body></html>";

  // Setup websocket server
  h.onMessage([](WebSocket<SERVER> *ws, char *message, size_t length, OpCode opCode) {
    string receivedMessage(message, length);
		cout << receivedMessage << endl;
		ws->send("Reponse from server", OpCode::BINARY);
    processMessage(receivedMessage);
  });

  // Setup http (webpage) server
  h.onHttpRequest([&](HttpResponse *res, HttpRequest req, char *data, size_t length,
                      size_t remainingBytes) {
    res->end(response.data(), response.length());
  });

  if (h.listen(3000))
  {
    h.run();
  }

  pthread_exit(NULL);
};

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
    calculateFixtures(false);
    calculateEffects();
    calculateFixtures(true);
    if (e131_send(sockfd, &packet, &dest) < 0)
      err(EXIT_FAILURE, "e131_send");
    //cout << "Frame" << endl;
    //e131_pkt_dump(stderr, &packet);
    packet.frame.seq_number++;
    usleep(250000);
  }

  pthread_exit(NULL);
}

int main()
{
  cout << "Tonalite 2.0 running! Press Ctrl + C to quit." << endl;
  pthread_t threads[2];
  int rc;
  int rc2;

  // Start HTTP and websocket server
  rc = pthread_create(&threads[0], NULL, serverLoop, (void *)0);
  if (rc)
  {
    cout << "Error:unable to create thread," << rc << endl;
    exit(-1);
  }

  // Start dmx server
  rc2 = pthread_create(&threads[1], NULL, startDMX, (void *)1);
  if (rc2)
  {
    cout << "Error:unable to create thread," << rc2 << endl;
    exit(-1);
  }

  pthread_exit(NULL);
};
