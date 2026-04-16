package com.shooting_simulator.util.serialization;

import com.shooting_simulator.util.math.geometry.Translation2d;
import com.google.gson.*;
import java.lang.reflect.Type;
import java.util.Map;

public class MapSerializer implements JsonSerializer<Map<Translation2d, Double>> {

    @Override
    public JsonElement serialize(
            Map<Translation2d, Double> src,
            Type typeOfSrc,
            JsonSerializationContext context) {

        JsonArray jsonArray = new JsonArray();

        for (Map.Entry<Translation2d, Double> entry : src.entrySet()) {
            JsonObject obj = new JsonObject();
            obj.add("key", context.serialize(entry.getKey()));
            obj.addProperty("value", entry.getValue());
            jsonArray.add(obj);
        }

        return jsonArray;
    }
}

