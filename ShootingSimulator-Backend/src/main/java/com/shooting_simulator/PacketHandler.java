package com.shooting_simulator;

import com.shooting_simulator.json.*;
import com.shooting_simulator.util.json.JsonUtil;
import org.java_websocket.WebSocket;

import java.util.Map;

public class PacketHandler {

    private final SimulatorServer server;

    // Register incoming React packets here
    private final Map<String, Class<? extends DataPacket>> packetTypes = Map.of(
            "calculate", SimulatorPacket.class,
            "sweep", SweepPacket.class,
            "surface", SurfacePacket.class,
            "optimal", OptimalPacket.class
    );

    public PacketHandler(SimulatorServer server) {
        this.server = server;
    }

    public void handlePacket(WebSocket conn, String message) {
        BasePacket base = JsonUtil.fromJson(message, BasePacket.class);

        System.out.println("Got " + base.type);
        Class<? extends DataPacket> clazz = this.packetTypes.get(base.type);
        if (clazz == null) {
            throw new IllegalArgumentException("Unknown packet type: " + base.type);
        }

        // Deserialize the specific packet data
        DataPacket packet = JsonUtil.fromJson(base.data, clazz);

        // Execute the packet logic, giving it the ability to reply
        packet.handle(conn, this.server);
    }
}