#include "utitities.hpp"

int mapRange(int num, int inMin, int inMax, int outMin, int outMax)
{
  return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};
