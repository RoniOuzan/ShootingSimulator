package com.shooting_simulator;

import com.shooting_simulator.json.BasePacket;
import com.shooting_simulator.util.json.JsonUtil;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class SimulatorServer extends WebSocketServer {

    private final Set<WebSocket> connections = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final ScheduledExecutorService physicsEngine = Executors.newSingleThreadScheduledExecutor();

    // Pass 'this' so the handler knows about the server
    private final PacketHandler packetHandler = new PacketHandler(this);

    public SimulatorServer(InetSocketAddress address) {
        super(address);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        connections.add(conn);
        System.out.println("Client Connected: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        connections.remove(conn);
        System.out.println("Client Disconnected: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            // Pass the specific connection so we can reply directly to it
            this.packetHandler.handlePacket(conn, message);
        } catch (Exception e) {
            System.err.println("Failed to parse message: " + message);
            e.printStackTrace();
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        ex.printStackTrace();
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket Server started on port: " + getPort());
        physicsEngine.scheduleAtFixedRate(this::periodic, 0, 20, TimeUnit.MILLISECONDS);
    }

    public void periodic() {
    }

    /**
     * Sends a packet to a specific connected client.
     */
    public void sendPacket(WebSocket conn, String type, Object dataPayload) {
        if (conn != null && conn.isOpen()) {
            // Package the data into your BasePacket structure
            BasePacket outgoing = new BasePacket(type, JsonUtil.toJsonObject(dataPayload));
            conn.send(JsonUtil.toJson(outgoing));
        }
    }

    /**
     * Broadcasts a packet to all connected React dashboards.
     */
    public void broadcastPacket(String type, Object dataPayload) {
        BasePacket outgoing = new BasePacket(type, JsonUtil.toJsonObject(dataPayload));
        String json = JsonUtil.toJson(outgoing);

        for (WebSocket conn : connections) {
            if (conn.isOpen()) {
                conn.send(json);
            }
        }
    }

    public static void main(String[] args) {
        WebSocketServer server = new SimulatorServer(new InetSocketAddress("localhost", 8080));
        server.start();
    }
}