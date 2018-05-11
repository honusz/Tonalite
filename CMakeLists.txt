cmake_minimum_required(VERSION 3.5.1)
set (CMAKE_CXX_STANDARD 11)
project (tonalite)
add_executable(tonalite src/tonalite.cpp src/e131.cpp src/utilities.cpp)
