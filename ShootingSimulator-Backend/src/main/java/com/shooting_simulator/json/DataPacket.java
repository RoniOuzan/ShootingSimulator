package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import org.java_websocket.WebSocket;

public interface DataPacket {
    void handle(WebSocket conn, SimulatorServer server);
}
