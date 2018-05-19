#include "utilities.hpp"

using namespace std;

string randomString()
{
  string str = "AAAAAA";

  // string sequence
  str[0] = rand() % 26 + 65;
  str[1] = rand() % 26 + 65;
  str[2] = rand() % 26 + 65;

  // number sequence
  str[3] = rand() % 10 + 48;
  str[4] = rand() % 10 + 48;
  str[5] = rand() % 10 + 48;

  return str;
}

int mapRange(int num, int inMin, int inMax, int outMin, int outMax)
{
  return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};
