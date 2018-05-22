#ifndef STRUCTS_H
#define STRUCTS_H

#include <string>

using namespace std;

struct channel
{
  string id;
  string type;
  string name;
  int max;
  int min;
  int displayMax;
  int displayMin;
  int defaultValue;
  int dmxAddress;
  int value;
  int displayValue;
  int defaultDisplayValue;
  bool active;
};

struct fixture
{
  string id;
  string name;
  string shortName;
  string manufacturer;
  int startDMXAddress;
  vector<channel> channels;
};

struct cue
{
  string id;
  string name;
  string description;
  bool active;
  int time;
  vector<fixture> fixtures;
};

#endif