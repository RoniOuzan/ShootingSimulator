package com.shooting_simulator.util.json;

import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.obstacles.ObstacleDeserializer;
import com.shooting_simulator.util.math.geometry.Translation2d;
import com.shooting_simulator.util.serialization.MapSerializer;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;

import java.util.Map;

public class JsonUtil {
    public static final Gson gson = new GsonBuilder()
            .registerTypeAdapter(
                    new TypeToken<Map<Translation2d, Double>>(){}.getType(),
                    new MapSerializer())
            .registerTypeAdapter(Obstacle.class, new ObstacleDeserializer())
            .serializeSpecialFloatingPointValues()
            .create();

    public static String toJson(Object object) {
        return gson.toJson(object);
    }

    public static String toJson(JsonObject object) {
        return gson.toJson(object);
    }

    public static JsonObject toJsonObject(Object object) {
        return gson.toJsonTree(object).getAsJsonObject();
    }

    public static <T> T fromJson(String json, Class<T> tClass) {
        return gson.fromJson(json, tClass);
    }

    public static <T> T fromJson(JsonObject json, Class<T> tClass) {
        return gson.fromJson(json, tClass);
    }
}
