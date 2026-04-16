package com.shooting_simulator.json;

import com.google.gson.JsonObject;
import lombok.AllArgsConstructor;
import lombok.ToString;

@AllArgsConstructor
@ToString
public class BasePacket {
    public String type;
    public JsonObject data;
}
