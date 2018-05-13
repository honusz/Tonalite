
add_executable(tonalite tonalite.cpp e131.cpp utilities.cpp uWebSockets/src/Extensions.cpp uWebSockets/src/Group.cpp uWebSockets/src/Networking.cpp uWebSockets/src/Hub.cpp uWebSockets/src/Node.cpp uWebSockets/src/WebSocket.cpp uWebSockets/src/HTTPSocket.cpp uWebSockets/src/Socket.cpp uWebSockets/src/Epoll.cpp uWebSockets/src/Room.cpp)
target_link_libraries(tonalite ssl crypto pthread)
find_package( ZLIB REQUIRED )
if ( ZLIB_FOUND )
    include_directories( ${ZLIB_INCLUDE_DIRS} )
    target_link_libraries( tonalite ${ZLIB_LIBRARIES} )
endif( ZLIB_FOUND )
