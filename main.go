package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Message struct {
	Type    string      `json:"type"`
	Content interface{} `json:"content"`
	Color   string      `json:"color"`
}

type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

var connections = make(map[*websocket.Conn]bool)
var broadcast = make(chan Message)

func main() {
	port := flag.Int("port", 8080, "Port to listen on")
	flag.Parse()

	go handleMessages()

	http.HandleFunc("/", serveHome)
	http.HandleFunc("/wss", handleConnections)

	log.Printf("Starting server on port %d...\n", *port)
	err := http.ListenAndServe(fmt.Sprintf(":%d", *port), nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func serveHome(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "home.html")
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer ws.Close()

	connections[ws] = true

	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("error: %v", err)
			delete(connections, ws)
			break
		}
		switch msg.Type {
		case "draw":
			broadcast <- msg
		case "clear":
			for conn := range connections {
				err := conn.WriteJSON(msg)
				if err != nil {
					log.Printf("error: %v", err)
					delete(connections, conn)
					conn.Close()
				}
			}
		}
	}
}

func handleMessages() {
	for {
		msg := <-broadcast
		for conn := range connections {
			err := conn.WriteJSON(msg)
			if err != nil {
				log.Printf("error: %v", err)
				delete(connections, conn)
				conn.Close()
			}
		}
	}
}
