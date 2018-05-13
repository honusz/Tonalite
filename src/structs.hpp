#ifndef STRUCTS_H
#define STRUCTS_H

#include <string>

using namespace std;

struct channel
{
  int id;
  string type;
  int max;
  int min;
  int displayMax;
  int displayMin;
  int defaultValue;
  int dmxAddress;
  int value;
  bool active;
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

#endif