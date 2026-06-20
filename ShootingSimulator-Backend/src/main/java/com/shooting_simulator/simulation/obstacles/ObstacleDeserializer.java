package com.shooting_simulator.simulation.obstacles;

import com.google.gson.*;
import java.lang.reflect.Type;

public class ObstacleDeserializer implements JsonDeserializer<Obstacle> {
    @Override
    public Obstacle deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context) 
            throws JsonParseException {
        
        JsonObject jsonObject = json.getAsJsonObject();
        JsonElement typeElement = jsonObject.get("type");

        if (typeElement == null) {
            throw new JsonParseException("Obstacle is missing the 'type' field.");
        }

        String type = typeElement.getAsString();

        // Map the string from React to your Java classes
        if ("CIRCLE".equals(type)) {
            return context.deserialize(jsonObject, CircleObstacle.class);
        } else if ("POLYGON".equals(type)) {
            return context.deserialize(jsonObject, PolygonObstacle.class);
        }

        throw new JsonParseException("Unknown obstacle type: " + type);
    }
}