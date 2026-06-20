package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import org.java_websocket.WebSocket;

import java.util.ArrayList;
import java.util.List;

public interface DataPacket {
    void handle(WebSocket conn, SimulatorServer server);

    default <T> List<T> decimate(List<T> list, int stride) {
        if (list == null || list.isEmpty()) return list;
        List<T> decimated = new ArrayList<>();
        for (int i = 0; i < list.size(); i += stride) {
            decimated.add(list.get(i));
        }
        // Always include the last point to keep the endpoint accurate
        if ((list.size() - 1) % stride != 0) {
            decimated.add(list.get(list.size() - 1));
        }
        return decimated;
    }
}
